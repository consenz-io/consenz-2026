import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
      // Use asServiceRole for all SectionVote operations — bypasses RLS so we can
      // count ALL votes (not just the current user's), matching voteOnSuggestion.
      const allVotes = await base44.asServiceRole.entities.SectionVote.filter({ sectionId });
      const userVotes = allVotes.filter(v => v.userId === user.id);

      // Clean up duplicate votes for this user (safety check — keep one)
      if (userVotes.length > 1) {
        await Promise.all(
          userVotes.slice(1).map(v => base44.asServiceRole.entities.SectionVote.delete(v.id))
        );
      }
      const existingVote = userVotes[0] || null;

      let action;
      if (existingVote) {
        if (existingVote.vote === vote) {
          // Toggle off — same vote clicked again
          await base44.asServiceRole.entities.SectionVote.delete(existingVote.id);
          action = 'deleted';
        } else {
          // Change vote direction
          await base44.asServiceRole.entities.SectionVote.update(existingVote.id, { vote });
          action = 'updated';
        }
      } else {
        await base44.asServiceRole.entities.SectionVote.create({ sectionId, userId: user.id, vote });
        action = 'created';
      }

      // Return fresh vote counts from DB (source of truth — all votes via service role)
      const freshVotes = await base44.asServiceRole.entities.SectionVote.filter({ sectionId });
      const proCount = freshVotes.filter(v => v.vote === 'pro').length;
      const conCount = freshVotes.filter(v => v.vote === 'con').length;

      // ── Inherited votes from ALL accepted suggestions linked to this section ──────
      // Deduplicated vote count: each user counted once.
      // Users who voted on the suggestion that created this section have their vote
      // inherited as a baseline. If that same user then votes directly on the section,
      // their direct vote overrides the inherited one (not added to it). This prevents
      // double-counting — e.g., 2 participants cannot produce 3 counted votes.
      // Only the MOST RECENT accepted suggestion's votes are inherited (older versions
      // don't accumulate).
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
          // Fetch individual Vote records for the latest suggestion — we need per-user
          // data to deduplicate with direct SectionVotes.
          const suggestionVotes = await base44.asServiceRole.entities.Vote.filter({
            suggestionId: latest.id
          });
          // Build dedup map: userId → vote. Start with inherited suggestion votes,
          // then override with direct SectionVotes (user's most recent stance wins).
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
        console.error('[VOTE ON SECTION source suggestion lookup error]', e);
      }

      // ── Deletion check ──────────────────────────────────────────────
      // For existing/accepted sections, voting is for deletion:
      // if opponents (con) minus supporters (pro) reaches the document's
      // support threshold, the section is automatically deleted.
      // Uses combined counts (inherited suggestion votes + live section votes).
      let sectionDeleted = false;
      const section = await base44.asServiceRole.entities.Section.get(sectionId).catch(() => null);
      if (section) {
        const document = await base44.asServiceRole.entities.Document.get(section.documentId).catch(() => null);
        const threshold = Math.max(2, document?.threshold || 2);

        if (totalCon - totalPro >= threshold) {
          // ── Create a delete_section suggestion record FIRST ──────────────
          // This makes the deletion visible on the suggestion detail page with
          // full voting results (date + vote counts), exactly like an accepted
          // suggestion. The notification will link to this suggestion.
          // Created BEFORE version records so we can stamp its ID on them —
          // this ensures useDocumentVersions groups them as a suggestion event
          // (correct before/after pairing) instead of direct_edit (which mispairs
          // when the section has prior version-less records).
          let deleteSuggestionId = null;
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
              // For a delete_section suggestion: "pro" = support deletion (SectionVote "con"),
              // "con" = oppose deletion / keep section (SectionVote "pro").
              // This mapping makes VotingProgressSection display correctly (delta >= threshold → passed).
              proVotes: totalCon,
              conVotes: totalPro,
              timerEndsAt: null,
              originalLanguage: section.originalLanguage || 'he',
              translations: {},
              participantsAtAcceptance: (totalCon + totalPro),
            });
            deleteSuggestionId = deleteSuggestion?.id || null;
          } catch (e) {
            console.error('[VOTE ON SECTION suggestion creation error]', e);
          }

          // Log version history entries before deleting (for reconstruction)
          try {
            const lastVersion = await base44.asServiceRole.entities.DocumentVersion.filter({ sectionId }, '-version', 1);
            const baseVersion = (lastVersion && lastVersion.length > 0 ? lastVersion[0].version : 0) + 1;
            // Mirror the processAcceptance deletion pattern: two version records —
            // 1. "before" record preserving the section content (for diff/reconstruction)
            // 2. "deletion" record with empty content (triggers isDeleted in useDocumentVersions,
            //    so the section renders in red in DocumentCleanView)
            // Both carry topicId + sectionOrder + suggestionId so they group correctly
            // and the deleted section content is displayed in DocumentCleanView.
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
            console.error('[VOTE ON SECTION version log error]', e);
          }

          // Anchor pending suggestions targeting this section to their original position
          // (topicId + originalSectionOrder) so they remain visible & votable after deletion.
          // We do NOT reject them — the community can still accept them, which recreates the section.
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
              console.log('[VOTE ON SECTION] Anchored', orphaned.length, 'orphaned suggestions to original position');
            }
          } catch (e) {
            console.error('[VOTE ON SECTION orphan anchor error]', e);
          }

          await base44.asServiceRole.entities.Section.delete(sectionId);
          // Clean up the section's votes too
          try {
            await base44.asServiceRole.entities.SectionVote.deleteMany({ sectionId });
          } catch (e) {
            console.error('[VOTE ON SECTION vote cleanup error]', e);
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
            // Exclude the voter who triggered the deletion
            participantIds.delete(user.id);

            const uniqueIds = [...participantIds];
            if (uniqueIds.length > 0) {
              const participants = await base44.asServiceRole.entities.User.filter({ id: { $in: uniqueIds } });
              const replacements = { title: document?.title || '' };
              const titleKey = 'sectionDeletedTitle';
              const messageKey = 'sectionDeletedMessage';
              const translationsObj = buildTranslations(titleKey, messageKey, replacements);
              // Link to the suggestion detail page so users see the full voting result.
              // Fall back to document view if suggestion creation failed.
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
              console.log('[VOTE ON SECTION] Created', notifications.length, 'section-deleted notifications');
            }
          } catch (e) {
            console.error('[VOTE ON SECTION notification error]', e);
          }

          sectionDeleted = true;
        }
      }

      return Response.json({ success: true, action, proCount, conCount, votes: freshVotes, sectionDeleted });

    } finally {
      processingVotes.delete(lockKey);
    }

  } catch (error) {
    console.error('[VOTE ON SECTION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});