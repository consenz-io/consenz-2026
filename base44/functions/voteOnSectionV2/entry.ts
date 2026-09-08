import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { calculateContributors, calculateActiveVoterCount, computeConsensusUpdate } from '../../shared/consensusLogic.ts';

// In-memory lock to prevent the same user voting on the same section concurrently
const processingVotes = new Set();

// ─── i18n for section-deleted notifications ─────────────────────────────────
const TRANSLATIONS = {
  en: {
    sectionDeletedTitle: "A section was removed from the document",
    sectionDeletedMessage: "A section in the document \"{title}\" was removed by community vote",
  },
  he: {
    sectionDeletedTitle: "סעיף הוסר מהמסמך",
    sectionDeletedMessage: "סעיף במסמך \"{title}\" הוסר בהצבעת קהילה",
  },
  ar: {
    sectionDeletedTitle: "تمت إزالة بند من الوثيقة",
    sectionDeletedMessage: "تمت إزالة بند في الوثيقة \"{title}\" بتصويت المجتمع",
  }
};

function t(lang, key, replacements = {}) {
  let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['he'][key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

function buildTranslations(titleKey, messageKey, replacements = {}) {
  const result = {};
  for (const lang of ['en', 'he', 'ar']) {
    result[lang] = {
      title: t(lang, titleKey, replacements),
      message: t(lang, messageKey, replacements),
    };
  }
  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sectionId, vote } = await req.json();

    if (!sectionId || !vote) {
      return Response.json({ error: 'Missing sectionId or vote' }, { status: 400 });
    }

    if (vote !== 'pro' && vote !== 'con') {
      return Response.json({ error: 'Invalid vote value' }, { status: 400 });
    }

    // Idempotency lock — prevent duplicate concurrent requests for same user+section
    const lockKey = `${user.id}-${sectionId}`;
    if (processingVotes.has(lockKey)) {
      return Response.json({ error: 'Vote already in progress' }, { status: 429 });
    }
    processingVotes.add(lockKey);
    setTimeout(() => processingVotes.delete(lockKey), 10000);

    try {
      const allVotes = await base44.asServiceRole.entities.SectionVote.filter({ sectionId });
      const userVotes = allVotes.filter(v => v.userId === user.id);

      if (userVotes.length > 1) {
        await Promise.all(
          userVotes.slice(1).map(v => base44.asServiceRole.entities.SectionVote.delete(v.id))
        );
      }
      const existingVote = userVotes[0] || null;

      let action;
      if (existingVote) {
        if (existingVote.vote === vote) {
          await base44.asServiceRole.entities.SectionVote.delete(existingVote.id);
          action = 'deleted';
        } else {
          await base44.asServiceRole.entities.SectionVote.update(existingVote.id, { vote });
          action = 'updated';
        }
      } else {
        await base44.asServiceRole.entities.SectionVote.create({ sectionId, userId: user.id, vote });
        action = 'created';
      }

      // ── Update document.totalUsersInteracted ────────────────────────
      if (action === 'created') {
        try {
          const sec = await base44.asServiceRole.entities.Section.get(sectionId).catch(() => null);
          if (sec) {
            const totalUsers = await calculateContributors(base44, sec.documentId);
            await base44.asServiceRole.entities.Document.update(sec.documentId, { totalUsersInteracted: totalUsers });
          }
        } catch (e) {
          console.error('[VOTE ON SECTION V2 totalUsersInteracted update error]', e);
        }
      }

      const freshVotes = await base44.asServiceRole.entities.SectionVote.filter({ sectionId });
      const proCount = freshVotes.filter(v => v.vote === 'pro').length;
      const conCount = freshVotes.filter(v => v.vote === 'con').length;

      // ── Inherited votes from the most recent accepted suggestion linked to this section ──
      let totalPro = proCount;
      let totalCon = conCount;
      try {
        const [creationSuggs, editSuggs] = await Promise.all([
          base44.asServiceRole.entities.Suggestion.filter({
            sectionId, status: 'accepted', type: 'new_section'
          }),
          base44.asServiceRole.entities.Suggestion.filter({
            sectionId, status: 'accepted', type: 'edit_section'
          })
        ]);
        let latest = null;
        for (const s of [...creationSuggs, ...editSuggs]) {
          if (!latest || new Date(s.updated_date) > new Date(latest.updated_date)) {
            latest = s;
          }
        }
        if (latest) {
          const suggestionVotes = await base44.asServiceRole.entities.Vote.filter({
            suggestionId: latest.id
          });
          const dedupMap = new Map();
          for (const v of suggestionVotes) {
            if (v.userId) dedupMap.set(v.userId, v.vote);
          }
          for (const v of freshVotes) {
            if (v.userId) dedupMap.set(v.userId, v.vote);
          }
          totalPro = Array.from(dedupMap.values()).filter(v => v === 'pro').length;
          totalCon = Array.from(dedupMap.values()).filter(v => v === 'con').length;
        }
      } catch (e) {
        console.error('[VOTE ON SECTION V2 source suggestion lookup error]', e);
      }

      // ── Deletion check ──────────────────────────────────────────────
      let sectionDeleted = false;
      let deleteSuggestionId = null;
      const section = await base44.asServiceRole.entities.Section.get(sectionId).catch(() => null);
      if (section) {
        const document = await base44.asServiceRole.entities.Document.get(section.documentId).catch(() => null);
        const threshold = Math.max(2, document?.threshold || 2);

        if (totalCon - totalPro >= threshold) {
          // ── Compute consensus impact (mirrors processAcceptanceV2) ────────
          let boundedConsensus = null;
          let updatedConsensuses = null;
          let newThreshold = threshold;
          let consensusTotalUsers = null;
          try {
            consensusTotalUsers = await calculateContributors(base44, section.documentId);
            const activeVoterCount = await calculateActiveVoterCount(base44, section.documentId);
            const deleteDelta = totalCon - totalPro;
            const consensusRes = computeConsensusUpdate({
              document,
              delta: deleteDelta,
              totalUsers: consensusTotalUsers,
              activeVoterCount,
            });
            boundedConsensus = consensusRes.boundedConsensus;
            updatedConsensuses = consensusRes.updatedConsensuses;
            newThreshold = consensusRes.newThreshold;
            console.log('[VOTE ON SECTION V2] Consensus update:', { consensusTotalUsers, deleteDelta, boundedConsensus, newThreshold });
          } catch (e) {
            console.error('[VOTE ON SECTION V2 consensus calc error]', e);
          }

          // ── Create a delete_section suggestion record FIRST ──────────────
          try {
            const deleteSuggestion = await base44.asServiceRole.entities.Suggestion.create({
              documentId: section.documentId,
              sectionId,
              topicId: section.topicId,
              originalSectionOrder: section.order,
              type: 'delete_section',
              title: 'מחיקת סעיף בהצבעת קהילה',
              originalContent: section.content,
              newContent: '',
              explanation: '',
              status: 'accepted',
              proVotes: totalCon,
              conVotes: totalPro,
              timerEndsAt: null,
              originalLanguage: section.originalLanguage || 'he',
              translations: {},
              suggestionConsensus: boundedConsensus,
              participantsAtAcceptance: consensusTotalUsers,
              acceptedAt: new Date().toISOString()
            });
            deleteSuggestionId = deleteSuggestion?.id || null;
          } catch (e) {
            console.error('[VOTE ON SECTION V2 suggestion creation error]', e);
          }

          // ── Repoint all section comments to the delete suggestion ──────────
          if (deleteSuggestionId) {
            try {
              const sectionComments = await base44.asServiceRole.entities.Comment.filter({
                rootEntityType: 'section', rootEntityId: sectionId
              });
              if (sectionComments.length > 0) {
                await Promise.all(
                  sectionComments.map(c =>
                    base44.asServiceRole.entities.Comment.update(c.id, {
                      rootEntityType: 'suggestion',
                      rootEntityId: deleteSuggestionId
                    })
                  )
                );
                console.log('[VOTE ON SECTION V2] Repointed', sectionComments.length, 'section comments to delete suggestion');
              }
            } catch (e) {
              console.error('[VOTE ON SECTION V2 comment repoint error]', e);
            }
          }

          // Log version history entries before deleting (for reconstruction)
          try {
            const lastVersion = await base44.asServiceRole.entities.DocumentVersion.filter({ sectionId }, '-version', 1);
            const baseVersion = (lastVersion && lastVersion.length > 0 ? lastVersion[0].version : 0) + 1;
            await base44.asServiceRole.entities.DocumentVersion.create({
              documentId: section.documentId,
              sectionId,
              topicId: section.topicId,
              sectionOrder: section.order,
              content: section.content,
              changeDescription: `לפני: הסעיף נמחק בהצבעת קהילה`,
              version: baseVersion,
              changeType: 'section_deleted',
              suggestionId: deleteSuggestionId || undefined,
              originalLanguage: section.originalLanguage || 'he',
              translations: section.translations || {},
            });
            await base44.asServiceRole.entities.DocumentVersion.create({
              documentId: section.documentId,
              sectionId,
              topicId: section.topicId,
              sectionOrder: section.order,
              content: '',
              changeDescription: 'הסעיף נמחק בהצבעת קהילה',
              version: baseVersion + 1,
              changeType: 'section_deleted',
              suggestionId: deleteSuggestionId || undefined,
              originalLanguage: section.originalLanguage || 'he',
              translations: {},
            });
          } catch (e) {
            console.error('[VOTE ON SECTION V2 version log error]', e);
          }

          // Anchor pending suggestions targeting this section to their original position
          try {
            const orphaned = await base44.asServiceRole.entities.Suggestion.filter({
              documentId: section.documentId,
              status: 'pending',
              sectionId
            });
            if (orphaned.length > 0) {
              await Promise.all(
                orphaned.map(s =>
                  base44.asServiceRole.entities.Suggestion.update(s.id, {
                    topicId: s.topicId || section.topicId,
                    originalSectionOrder: section.order
                  })
                )
              );
              console.log('[VOTE ON SECTION V2] Anchored', orphaned.length, 'orphaned suggestions to original position');
            }
          } catch (e) {
            console.error('[VOTE ON SECTION V2 orphan anchor error]', e);
          }

          await base44.asServiceRole.entities.Section.delete(sectionId);
          try {
            await base44.asServiceRole.entities.SectionVote.deleteMany({ sectionId });
          } catch (e) {
            console.error('[VOTE ON SECTION V2 vote cleanup error]', e);
          }

          // ── Update document consensus meter + threshold ────────────────
          if (updatedConsensuses !== null && boundedConsensus !== null) {
            try {
              const consensusMeterAverage = updatedConsensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / updatedConsensuses.length;
              await base44.asServiceRole.entities.Document.update(section.documentId, {
                consensuses: updatedConsensuses,
                avgSuggestionConsensus: consensusMeterAverage,
                threshold: newThreshold,
                totalUsersInteracted: consensusTotalUsers,
                participantsAtThreshold: consensusTotalUsers,
              });
            } catch (e) {
              console.error('[VOTE ON SECTION V2 document consensus update error]', e);
            }
          }

          // ── Notify all document participants about the deletion ────────
          try {
            const [interactions, groupMembers] = await Promise.all([
              base44.asServiceRole.entities.UserInteraction.filter({ documentId: section.documentId }),
              document?.groupId
                ? base44.asServiceRole.entities.GroupMember.filter({ groupId: document.groupId })
                : Promise.resolve([])
            ]);

            const participantIds = new Set(interactions.map(i => i.userId));
            groupMembers.forEach(m => { if (m.userId) participantIds.add(m.userId); });
            participantIds.delete(user.id);

            const uniqueIds = [...participantIds];
            if (uniqueIds.length > 0) {
              const participants = await base44.asServiceRole.entities.User.filter({ id: { $in: uniqueIds } });
              const replacements = { title: document?.title || '' };
              const titleKey = 'sectionDeletedTitle';
              const messageKey = 'sectionDeletedMessage';
              const translationsObj = buildTranslations(titleKey, messageKey, replacements);
              const actionUrl = deleteSuggestionId
                ? `/suggestiondetail?id=${deleteSuggestionId}`
                : `/DocumentView?id=${section.documentId}`;

              const notifications = participants.map(p => {
                const userLang = p.preferredLanguage || 'he';
                return {
                  userId: p.id,
                  type: 'section_deleted',
                  title: t(userLang, titleKey, replacements),
                  message: t(userLang, messageKey, replacements),
                  translations: translationsObj,
                  relatedEntityId: deleteSuggestionId || section.documentId,
                  relatedEntityType: deleteSuggestionId ? 'suggestion' : 'document',
                  actionUrl,
                  read: false,
                };
              });

              await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
              console.log('[VOTE ON SECTION V2] Created', notifications.length, 'section-deleted notifications');
            }
          } catch (e) {
            console.error('[VOTE ON SECTION V2 notification error]', e);
          }

          sectionDeleted = true;
        }
      }

      return Response.json({ success: true, action, proCount, conCount, votes: freshVotes, sectionDeleted, deleteSuggestionId: deleteSuggestionId || null });

    } finally {
      processingVotes.delete(lockKey);
    }

  } catch (error) {
    console.error('[VOTE ON SECTION V2 ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});