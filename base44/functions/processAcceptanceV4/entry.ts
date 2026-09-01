import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { awardSuggestionPointsLogic } from '../../shared/awardSuggestionPointsLogic.ts';

const NOTIF_TRANSLATIONS = {
  en: {
    creatorTitle: "🎉 Your suggestion was accepted!",
    creatorMessage: "The suggestion \"{title}\" was accepted and added to the document",
    participantTitle: "A suggestion was accepted in the document",
    participantMessage: "The suggestion \"{title}\" was accepted in the document \"{doc}\"",
  },
  he: {
    creatorTitle: "🎉 ההצעה שלך התקבלה!",
    creatorMessage: "ההצעה \"{title}\" התקבלה ונוספה למסמך",
    participantTitle: "הצעה התקבלה במסמך",
    participantMessage: "ההצעה \"{title}\" התקבלה במסמך \"{doc}\"",
  },
  ar: {
    creatorTitle: "🎉 تم قبول اقتراحك!",
    creatorMessage: "تم قبول الاقتراح \"{title}\" وإضافته إلى المستند",
    participantTitle: "تم قبول اقتراح في المستند",
    participantMessage: "تم قبول الاقتراح \"{title}\" في المستند \"{doc}\"",
  }
};

function nt(lang, key, replacements = {}) {
  let text = NOTIF_TRANSLATIONS[lang]?.[key] || NOTIF_TRANSLATIONS['he'][key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

function buildNotifTranslations(titleKey, messageKey, replacements = {}) {
  const result = {};
  for (const lang of ['en', 'he', 'ar']) {
    result[lang] = {
      title: nt(lang, titleKey, replacements),
      message: nt(lang, messageKey, replacements),
    };
  }
  return result;
}

const detectLanguage = (text) => {
  if (!text) return 'he';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

// Filter out non-ObjectId strings (e.g. service-role UUIDs like "service_xxx-xxx-xxx")
// before passing them to User.filter — MongoDB rejects them with "not a valid ObjectId".
const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
const filterValidObjectIds = (ids) => ids.filter(isValidObjectId);

async function calculateContributors(base44, documentId) {
  const [suggestions, sections, agreements] = await Promise.all([
    base44.asServiceRole.entities.Suggestion.filter({ documentId }),
    base44.asServiceRole.entities.Section.filter({ documentId }),
    base44.asServiceRole.entities.DocumentAgreement.filter({ documentId })
  ]);

  const suggestionIds = suggestions.map(s => s.id);
  const sectionIds = sections.map(s => s.id);

  const [votes, profiles, docComments, sectionComments, suggestionComments, sectionVotes] = await Promise.all([
    suggestionIds.length > 0
      ? base44.asServiceRole.entities.Vote.filter({ suggestionId: { $in: suggestionIds } })
      : Promise.resolve([]),
    base44.asServiceRole.entities.UserPublicProfile.list(),
    base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'document', rootEntityId: documentId }),
    sectionIds.length > 0
      ? base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'section', rootEntityId: { $in: sectionIds } })
      : Promise.resolve([]),
    suggestionIds.length > 0
      ? base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'suggestion', rootEntityId: { $in: suggestionIds } })
      : Promise.resolve([]),
    sectionIds.length > 0
      ? base44.asServiceRole.entities.SectionVote.filter({ sectionId: { $in: sectionIds } })
      : Promise.resolve([]),
  ]);

  const comments = [...docComments, ...sectionComments, ...suggestionComments];

  const emailToUserId = new Map();
  profiles.forEach(p => { if (p.email && p.userId) emailToUserId.set(p.email, p.userId); });

  const uniqueParticipants = new Set();

  const addByKey = (userId, email) => {
    if (userId) uniqueParticipants.add(userId);
    else if (email) { const uid = emailToUserId.get(email); uniqueParticipants.add(uid || email); }
  };

  votes.forEach(v => { addByKey(v.userId, v.created_by); });
  comments.forEach(c => { addByKey(c.created_by_id, c.created_by); });
  agreements.forEach(a => { addByKey(a.userId, a.userEmail); });
  suggestions.forEach(s => { addByKey(s.created_by_id, s.created_by); });
  sectionVotes.forEach(v => { addByKey(v.userId, v.created_by); });

  return Math.max(1, uniqueParticipants.size);
}

// ── Shared section-creation logic ──
// Used by both the `new_section` acceptance branch and the `edit_suggestion`-on-`new_section`
// branch. Resolves the target topic (existing or newly created from newTopicTitle), computes
// the insertion order (with shifting of existing sections + pending new_section suggestions),
// creates the Section, and records the initial DocumentVersion (changeType: section_created).
// Returns { newSection, targetTopicId }.
async function createNewSectionFromSuggestion(base44, suggestion, voterId) {
  let targetTopicId = suggestion.topicId;

  if (!targetTopicId && suggestion.newTopicTitle) {
    const existingTopics = await base44.asServiceRole.entities.Topic.filter({ documentId: suggestion.documentId }, 'order');
    const maxOrder = existingTopics.length > 0 ? Math.max(...existingTopics.map(t => t.order || 0)) : -1;
    const newTopicLanguage = detectLanguage(suggestion.newTopicTitle);

    const newTopic = await base44.asServiceRole.entities.Topic.create({
      documentId: suggestion.documentId,
      title: suggestion.newTopicTitle,
      order: suggestion.newTopicOrder ?? (maxOrder + 1),
      originalLanguage: newTopicLanguage
    });
    targetTopicId = newTopic?.id;
  }

  if (!targetTopicId) {
    throw new Error('No targetTopicId for new section');
  }

  const allSections = await base44.asServiceRole.entities.Section.filter({ documentId: suggestion.documentId, topicId: targetTopicId });
  const maxOrder = allSections.length > 0 ? Math.max(...allSections.map(s => s.order || 0)) : -1;

  let newOrder;
  if (suggestion.insertPosition !== undefined && suggestion.insertPosition !== null) {
    newOrder = Math.floor(suggestion.insertPosition);
    const sectionsToShift = allSections.filter(s => s.order >= newOrder);
    if (sectionsToShift.length > 0) {
      await Promise.all(
        sectionsToShift.map(s => base44.asServiceRole.entities.Section.update(s.id, { order: s.order + 1 }))
      );

      const pendingNewSectionSuggs = await base44.asServiceRole.entities.Suggestion.filter({
        documentId: suggestion.documentId,
        topicId: targetTopicId,
        type: 'new_section',
        status: 'pending'
      });
      const suggsToShift = pendingNewSectionSuggs.filter(s =>
        s.id !== suggestion.id &&
        s.insertPosition !== undefined &&
        s.insertPosition !== null &&
        s.insertPosition >= newOrder
      );
      if (suggsToShift.length > 0) {
        await Promise.all(
          suggsToShift.map(s =>
            base44.asServiceRole.entities.Suggestion.update(s.id, { insertPosition: s.insertPosition + 1 })
          )
        );
        console.log('[PROCESS ACCEPTANCE V4] Shifted insertPosition for', suggsToShift.length, 'pending suggestions');
      }
    }
  } else {
    newOrder = maxOrder + 1;
  }

  const newContentLanguage = detectLanguage(suggestion.newContent || '');
  const newSection = await base44.asServiceRole.entities.Section.create({
    documentId: suggestion.documentId,
    topicId: targetTopicId,
    content: suggestion.newContent,
    order: newOrder,
    lastEditedBy: voterId,
    originalLanguage: newContentLanguage,
    translations: {}
  });

  await base44.asServiceRole.entities.DocumentVersion.create({
    documentId: suggestion.documentId,
    sectionId: newSection.id,
    content: suggestion.newContent,
    changeDescription: suggestion.title || 'סעיף חדש',
    version: 1,
    changeType: 'section_created',
    suggestionId: suggestion.id,
    originalLanguage: newContentLanguage,
    translations: {}
  });

  return { newSection, targetTopicId };
}

Deno.serve(async (req) => {
  let base44;
  let suggestionId;
  let lockAcquired = false;

  try {
    base44 = createClientFromRequest(req);

    let documentId, voterId, wasNewVote, forceAccept, forceReleaseLock;
    ({ suggestionId, documentId, voterId, wasNewVote, forceAccept, forceReleaseLock } = await req.json());

    console.log('[PROCESS ACCEPTANCE V4] Starting for suggestion:', suggestionId, 'at', new Date().toISOString());

    const [suggestion, document] = await Promise.all([
      base44.asServiceRole.entities.Suggestion.get(suggestionId),
      base44.asServiceRole.entities.Document.get(documentId)
    ]);

    if (!suggestion || !document) {
      console.error('[PROCESS ACCEPTANCE V4] Suggestion or document not found');
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    if (suggestion.status !== 'pending') {
      console.log('[PROCESS ACCEPTANCE V4] Already processed, skipping');
      return Response.json({ success: true, message: 'Already processed' });
    }

    // forceAccept bypasses the threshold check (admin override). Only an authenticated
    // admin may bypass it; internal chain calls only pass forceAccept after the parent
    // already meets the threshold, so degrading to the threshold check here is safe.
    let _forceUser = null;
    try { _forceUser = await base44.auth.me(); } catch {}
    const canForceAccept = !!forceAccept && _forceUser?.role === 'admin';
    if (!canForceAccept) {
      const verifyDelta = (suggestion.proVotes || 0) - (suggestion.conVotes || 0);
      const verifyThreshold = document.threshold > 0 ? Math.max(2, document.threshold) : 2;
      if (verifyDelta < verifyThreshold) {
        console.log('[PROCESS ACCEPTANCE V4] Suggestion no longer meets threshold, aborting. delta:', verifyDelta, 'threshold:', verifyThreshold);
        return Response.json({ success: true, message: 'Threshold not met, acceptance aborted' });
      }
    }

    // ── Acquire the acceptance lock (atomic CAS with stale recovery + retry) ──
    if (forceReleaseLock) {
      console.log('[PROCESS ACCEPTANCE V4] forceReleaseLock=true, releasing any stuck lock for', suggestionId);
      await base44.asServiceRole.entities.Suggestion.update(suggestionId, { acceptanceLock: false }).catch(() => {});
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const lockResult = await base44.asServiceRole.entities.Suggestion.updateMany(
        { id: suggestionId, status: 'pending', acceptanceLock: false },
        { $set: { acceptanceLock: true } }
      );
      if (lockResult && lockResult.updated === 1) {
        lockAcquired = true;
        console.log('[PROCESS ACCEPTANCE V4] Lock acquired on attempt', attempt);
        break;
      }
      if (attempt === 1) {
        const lockCheck = await base44.asServiceRole.entities.Suggestion.get(suggestionId);
        if (lockCheck && lockCheck.status === 'pending' && lockCheck.acceptanceLock === true) {
          const lockAgeMs = Date.now() - new Date(lockCheck.updated_date).getTime();
          console.log('[PROCESS ACCEPTANCE V4] Lock held (age:', Math.round(lockAgeMs / 1000) + 's) on attempt 1');
          if (lockAgeMs > 90000 || forceReleaseLock) {
            console.log('[PROCESS ACCEPTANCE V4] Force-releasing stale lock for', suggestionId);
            await base44.asServiceRole.entities.Suggestion.update(suggestionId, { acceptanceLock: false });
          }
        }
      }
    }
    if (!lockAcquired) {
      console.log('[PROCESS ACCEPTANCE V4] Lock not acquired after retry, another instance holds it');
      return Response.json({ success: true, message: 'Already being processed' });
    }

    lockAcquired = true;

    const totalUsers = await calculateContributors(base44, documentId);

    const delta = (suggestion.proVotes || 0) - (suggestion.conVotes || 0);
    const sectionConsensus = (delta + totalUsers) / (2 * totalUsers);
    const boundedConsensus = Math.min(1, Math.max(0, sectionConsensus));

    const updatedConsensuses = [...(document.consensuses || []), boundedConsensus];
    const consensusMeterAverage = updatedConsensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / updatedConsensuses.length;

    let activeVoterCount = 0;
    try {
      const docSuggs = await base44.asServiceRole.entities.Suggestion.filter({ documentId: document.id });
      const docSuggIds = docSuggs.map(s => s.id);
      const docSecs = await base44.asServiceRole.entities.Section.filter({ documentId: document.id });
      const docSecIds = docSecs.map(s => s.id);
      const [suggVotes, secVotes] = await Promise.all([
        docSuggIds.length > 0
          ? base44.asServiceRole.entities.Vote.filter({ suggestionId: { $in: docSuggIds } })
          : Promise.resolve([]),
        docSecIds.length > 0
          ? base44.asServiceRole.entities.SectionVote.filter({ sectionId: { $in: docSecIds } })
          : Promise.resolve([]),
      ]);
      const voterIds = new Set();
      suggVotes.forEach(v => { if (v.userId) voterIds.add(v.userId); });
      secVotes.forEach(v => { if (v.userId) voterIds.add(v.userId); });
      activeVoterCount = voterIds.size;
    } catch (e) {
      console.error('[PROCESS ACCEPTANCE V4] active voter count failed, skipping cap:', e);
    }

    const rawThreshold = Math.max(2, Math.round(consensusMeterAverage * totalUsers));
    const cap = activeVoterCount > 0 ? Math.max(2, activeVoterCount) : rawThreshold;
    const newThreshold = Math.min(rawThreshold, cap);

    console.log('[PROCESS ACCEPTANCE V4] Calculated:', { totalUsers, activeVoterCount, boundedConsensus, rawThreshold, cap, newThreshold });

    if (suggestion.type === 'edit_section' && suggestion.sectionId) {
      let section = await base44.asServiceRole.entities.Section.filter({ id: suggestion.sectionId }).then(r => r[0]);

      if (!section) {
        const resurrectTopicId = suggestion.topicId;
        if (!resurrectTopicId) {
          console.error('[PROCESS ACCEPTANCE V4] Cannot resurrect — no topicId on suggestion');
          return Response.json({ error: 'Section not found and no topicId to resurrect' }, { status: 400 });
        }

        const newContentLanguage = detectLanguage(suggestion.newContent || '');
        const resurrectOrder = suggestion.originalSectionOrder != null
          ? suggestion.originalSectionOrder
          : (await base44.asServiceRole.entities.Section.filter({ documentId: suggestion.documentId, topicId: resurrectTopicId }))
              .reduce((max, s) => Math.max(max, s.order || 0), -1) + 1;

        section = await base44.asServiceRole.entities.Section.create({
          documentId: suggestion.documentId,
          topicId: resurrectTopicId,
          content: suggestion.newContent,
          order: resurrectOrder,
          lastEditedBy: voterId,
          originalLanguage: newContentLanguage,
          translations: {}
        });

        await base44.asServiceRole.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: suggestion.newContent,
          changeDescription: suggestion.title || 'שחזור סעיף שנמחק',
          version: 1,
          changeType: 'section_created',
          suggestionId: suggestion.id,
          originalLanguage: newContentLanguage,
          translations: {}
        });

        await base44.asServiceRole.entities.Suggestion.update(suggestion.id, {
          sectionId: section.id,
          originalSectionOrder: null
        });

        const resurrectChildren = await base44.asServiceRole.entities.Suggestion.filter({
          parentSuggestionId: suggestion.id
        });
        const pendingResurrectChildren = resurrectChildren.filter(c => c.status === 'pending');
        if (pendingResurrectChildren.length > 0) {
          console.log('[PROCESS ACCEPTANCE V4] Re-linking', pendingResurrectChildren.length, 'child suggestions to resurrected section', section.id);
          for (const child of pendingResurrectChildren) {
            await base44.asServiceRole.entities.Suggestion.update(child.id, {
              sectionId: section.id,
              type: 'edit_section',
              parentSuggestionId: null
            });
          }
        }

        const sameSlotOrphans = await base44.asServiceRole.entities.Suggestion.filter({
          documentId: suggestion.documentId,
          status: 'pending',
          sectionId: suggestion.sectionId
        });
        const otherSlotOrphans = sameSlotOrphans.filter(s => s.id !== suggestion.id && !s.parentSuggestionId);
        if (otherSlotOrphans.length > 0) {
          console.log('[PROCESS ACCEPTANCE V4] Re-linking', otherSlotOrphans.length, 'orphaned suggestions to resurrected section', section.id);
          for (const s of otherSlotOrphans) {
            await base44.asServiceRole.entities.Suggestion.update(s.id, {
              sectionId: section.id,
              originalSectionOrder: null
            });
          }
        }

        console.log('[PROCESS ACCEPTANCE V4] Resurrected deleted section', section.id, 'at order', resurrectOrder);

      } else {
        const versions = await base44.asServiceRole.entities.DocumentVersion.filter({ sectionId: section.id });
        const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;
        const newContentLanguage = detectLanguage(suggestion.newContent || '');

        await Promise.all([
          base44.asServiceRole.entities.DocumentVersion.create({
            documentId: suggestion.documentId,
            sectionId: section.id,
            content: section.content,
            changeDescription: `לפני: ${suggestion.title || 'הצעת עריכה'}`,
            version: nextVersion,
            changeType: 'suggestion_accepted',
            suggestionId: suggestion.id
          }),
          base44.asServiceRole.entities.Section.update(section.id, {
            content: suggestion.newContent,
            lastEditedBy: voterId,
            originalLanguage: newContentLanguage,
            translations: {}
          })
        ]);

        await base44.asServiceRole.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: suggestion.newContent,
          changeDescription: suggestion.title || 'הצעת עריכה',
          version: nextVersion + 1,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id
        });
      }

    } else if (suggestion.type === 'new_section') {
      if (suggestion.sectionId) {
        console.log('[PROCESS ACCEPTANCE V4] new_section already has sectionId', suggestion.sectionId, '— skipping section creation (retry recovery)');
      } else {
      const { newSection } = await createNewSectionFromSuggestion(base44, suggestion, voterId);

      const childEditSuggestions = await base44.asServiceRole.entities.Suggestion.filter({
        parentSuggestionId: suggestion.id
      });
      const pendingChildren = childEditSuggestions.filter(c => c.status === 'pending');
      if (pendingChildren.length > 0) {
        console.log('[PROCESS ACCEPTANCE V4] Re-linking', pendingChildren.length, 'child suggestions to new section', newSection.id);
        for (const child of pendingChildren) {
          await base44.asServiceRole.entities.Suggestion.update(child.id, {
            sectionId: newSection.id,
            type: 'edit_section',
            parentSuggestionId: null
          });
        }
      }

      await base44.asServiceRole.entities.Suggestion.update(suggestion.id, {
        sectionId: newSection.id,
        originalContent: suggestion.newContent,
        parentSuggestionId: null
      });
      } // end section-creation guard

    } else if (suggestion.type === 'edit_suggestion' && suggestion.parentSuggestionId) {
      const parentSuggestion = await base44.asServiceRole.entities.Suggestion.get(suggestion.parentSuggestionId);

      if (parentSuggestion && parentSuggestion.type === 'new_section' && parentSuggestion.status === 'pending') {
        // NEW BEHAVIOR (V4): an edit_suggestion accepted on a still-pending new_section
        // creates the section itself (from the edit's content) and converts the parent
        // new_section + any sibling edit_suggestions into edit_section proposals on the
        // newly created section. Votes on the converted suggestions are preserved.
        let newSection;
        if (suggestion.sectionId) {
          // Retry recovery: section was already created in a partial prior run.
          newSection = await base44.asServiceRole.entities.Section.filter({ id: suggestion.sectionId }).then(r => r[0]);
          console.log('[PROCESS ACCEPTANCE V4] Reusing existing section on retry:', suggestion.sectionId);
        } else {
          const result = await createNewSectionFromSuggestion(base44, suggestion, voterId);
          newSection = result.newSection;
        }

        if (newSection) {
          // Convert the parent new_section (A) into an edit_section on the new section.
          // Its newContent (A's original proposal) is unchanged; originalContent becomes
          // the section's current content (B's content) so the diff shows A vs. B.
          await base44.asServiceRole.entities.Suggestion.update(parentSuggestion.id, {
            type: 'edit_section',
            sectionId: newSection.id,
            parentSuggestionId: null,
            originalContent: newSection.content
          });
          console.log('[PROCESS ACCEPTANCE V4] Converted parent new_section to edit_section:', parentSuggestion.id);

          // Convert any sibling edit_suggestions (C, D) on the parent into edit_section
          // proposals on the new section. Their newContent is unchanged; originalContent
          // becomes the section's current content (B's content).
          const siblings = await base44.asServiceRole.entities.Suggestion.filter({
            parentSuggestionId: parentSuggestion.id,
            status: 'pending'
          });
          const otherSiblings = siblings.filter(s => s.id !== suggestion.id);
          for (const sibling of otherSiblings) {
            await base44.asServiceRole.entities.Suggestion.update(sibling.id, {
              type: 'edit_section',
              sectionId: newSection.id,
              parentSuggestionId: null,
              originalContent: newSection.content
            });
          }
          if (otherSiblings.length > 0) {
            console.log('[PROCESS ACCEPTANCE V4] Converted', otherSiblings.length, 'sibling edit_suggestions to edit_section');
          }

          // Stamp the accepted edit_suggestion (B) with the new section id.
          if (!suggestion.sectionId) {
            await base44.asServiceRole.entities.Suggestion.update(suggestion.id, {
              sectionId: newSection.id
            });
          }
        }
      } else if (parentSuggestion && suggestion.sectionId) {
        // Retry recovery: section already created and parent already converted in a
        // prior partial run — nothing left to do here; common finalization below
        // will mark B as accepted.
        console.log('[PROCESS ACCEPTANCE V4] edit_suggestion retry — section already created and parent converted:', suggestion.sectionId);
      } else if (parentSuggestion) {
        // ORIGINAL BEHAVIOR: edit_suggestion on an edit_section parent (or a parent that
        // is no longer pending) — update the parent's proposed content with this edit's
        // content, and trigger the parent's acceptance if it now meets threshold.
        const newContentLanguage = detectLanguage(suggestion.newContent || '');
        await base44.asServiceRole.entities.Suggestion.update(suggestion.parentSuggestionId, {
          newContent: suggestion.newContent,
          originalLanguage: newContentLanguage,
          translations: {}
        });
        console.log('[PROCESS ACCEPTANCE V4] Updated parent suggestion content:', suggestion.parentSuggestionId);

        if (parentSuggestion.status === 'pending') {
          const parentDelta = (parentSuggestion.proVotes || 0) - (parentSuggestion.conVotes || 0);
          const parentThreshold = document.threshold > 0 ? Math.max(2, document.threshold) : 2;
          if (parentDelta >= parentThreshold) {
            console.log('[PROCESS ACCEPTANCE V4] Parent still pending AND meets threshold, triggering its acceptance:', suggestion.parentSuggestionId, { parentDelta, parentThreshold });
            try {
              await base44.asServiceRole.functions.invoke('processAcceptanceV4', {
                suggestionId: suggestion.parentSuggestionId,
                documentId: suggestion.documentId,
                voterId,
                wasNewVote,
                forceAccept: true,
                forceReleaseLock: true
              });
              console.log('[PROCESS ACCEPTANCE V4] Parent suggestion processed successfully');
            } catch (parentErr) {
              console.error('[PROCESS ACCEPTANCE V4] Failed to process parent suggestion:', parentErr);
            }
          } else {
            console.log('[PROCESS ACCEPTANCE V4] Parent still pending but below threshold — updated content only, NOT auto-accepting parent:', suggestion.parentSuggestionId, { parentDelta, parentThreshold });
          }
        }
      } else {
        console.warn('[PROCESS ACCEPTANCE V4] Parent suggestion not found:', suggestion.parentSuggestionId);
      }

    } else if (suggestion.type === 'delete_section' && suggestion.sectionId) {
      const section = await base44.asServiceRole.entities.Section.filter({ id: suggestion.sectionId }).then(r => r[0]);
      if (section) {
        const versions = await base44.asServiceRole.entities.DocumentVersion.filter({ sectionId: section.id });
        const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;

        await base44.asServiceRole.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: section.content,
          changeDescription: `לפני: ${suggestion.title || 'מחיקת סעיף'}`,
          version: nextVersion,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id,
          originalLanguage: section.originalLanguage || 'he',
          translations: section.translations || {}
        });

        await base44.asServiceRole.entities.Section.delete(section.id);

        try {
          const orphaned = await base44.asServiceRole.entities.Suggestion.filter({
            documentId: suggestion.documentId,
            status: 'pending',
            sectionId: section.id
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
            console.log('[PROCESS ACCEPTANCE V4] Anchored', orphaned.length, 'orphaned suggestions to original position');
          }
        } catch (orphanErr) {
          console.error('[PROCESS ACCEPTANCE V4] Failed to anchor orphaned suggestions:', orphanErr);
        }

        await base44.asServiceRole.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: '',
          changeDescription: suggestion.title || 'מחיקת סעיף',
          version: nextVersion + 1,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id
        });
      }
    }

    if (document.gamificationEnabled) {
      try {
        await awardSuggestionPointsLogic(base44.asServiceRole, {
          suggestionId: suggestion.id,
          action: 'suggestion_accepted'
        });
        console.log('[PROCESS ACCEPTANCE V4] ✓ Points awarded to creator');
      } catch (err) {
        console.error('[PROCESS ACCEPTANCE V4] Points award failed:', err);
      }
    }

    const pendingSuggestions = await base44.asServiceRole.entities.Suggestion.filter({
      documentId: document.id,
      status: 'pending'
    });

    const updates = [
      base44.asServiceRole.entities.Document.update(document.id, {
        consensuses: updatedConsensuses,
        threshold: newThreshold,
        totalUsersInteracted: totalUsers
      }),
      ...pendingSuggestions
        .filter(p => p.id !== suggestionId)
        .filter(p => p.type === 'edit_section' && p.sectionId === suggestion.sectionId && suggestion.type === 'edit_section')
        .map(p => base44.asServiceRole.entities.Suggestion.update(p.id, {
          originalContent: suggestion.newContent
        }))
    ];

    updates.push(
      base44.asServiceRole.entities.Suggestion.update(suggestion.id, {
        status: 'accepted',
        suggestionConsensus: boundedConsensus,
        participantsAtAcceptance: totalUsers
      })
    );

    await Promise.all(updates);

    console.log('[PROCESS ACCEPTANCE V4] Preparing notifications...');
    const notifications = [];

    const [docSuggestions, docSections, agreements] = await Promise.all([
      base44.asServiceRole.entities.Suggestion.filter({ documentId: document.id }),
      base44.asServiceRole.entities.Section.filter({ documentId: document.id }),
      base44.asServiceRole.entities.DocumentAgreement.filter({ documentId: document.id })
    ]);

    const docSuggestionIds = docSuggestions.map(s => s.id);
    const docSectionIds = docSections.map(s => s.id);

    const [docVotes, docComments] = await Promise.all([
      docSuggestionIds.length > 0
        ? base44.asServiceRole.entities.Vote.filter({ suggestionId: { $in: docSuggestionIds } })
        : Promise.resolve([]),
      base44.asServiceRole.entities.Comment.filter({
        rootEntityId: { $in: [...docSuggestionIds, ...docSectionIds, document.id] }
      })
    ]);

    const contributorIds = new Set();

    if (suggestion.created_by_id) contributorIds.add(suggestion.created_by_id);
    agreements.forEach(a => { if (a.userId) contributorIds.add(a.userId); });
    docVotes.forEach(v => { if (v.userId) contributorIds.add(v.userId); });
    docComments.forEach(c => { if (c.created_by_id) contributorIds.add(c.created_by_id); });
    docSuggestions.forEach(s => { if (s.created_by_id) contributorIds.add(s.created_by_id); });

    let allUsers = [];
    if (contributorIds.size > 0) {
      const idArray = filterValidObjectIds(Array.from(contributorIds));
      if (idArray.length > 0) {
        allUsers = await base44.asServiceRole.entities.User.filter({ id: { $in: idArray } });
      }
    }

    const suggTitle = suggestion.title || 'הצעה';
    const creatorReplacements = { title: suggTitle };
    const participantReplacements = { title: suggTitle, doc: document.title };
    const creatorTranslations = buildNotifTranslations('creatorTitle', 'creatorMessage', creatorReplacements);
    const participantTranslations = buildNotifTranslations('participantTitle', 'participantMessage', participantReplacements);

    for (const user of allUsers) {
      const userLang = user.preferredLanguage || 'he';
      if (user.id === suggestion.created_by_id) {
        notifications.push({
          userId: user.id,
          type: 'suggestion_accepted',
          title: nt(userLang, 'creatorTitle', creatorReplacements),
          message: nt(userLang, 'creatorMessage', creatorReplacements),
          translations: creatorTranslations,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl: `/documentview?id=${document.id}`,
          documentId: document.id,
          documentTitle: document.title
        });
      } else {
        notifications.push({
          userId: user.id,
          type: 'suggestion_accepted',
          title: nt(userLang, 'participantTitle', participantReplacements),
          message: nt(userLang, 'participantMessage', participantReplacements),
          translations: participantTranslations,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl: `/suggestiondetail?id=${suggestion.id}`,
          documentId: document.id,
          documentTitle: document.title
        });
      }
    }

    if (notifications.length > 0) {
      console.log('[PROCESS ACCEPTANCE V4] Sending', notifications.length, 'notifications...');
      try {
        await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
        console.log('[PROCESS ACCEPTANCE V4] ✓ Sent successfully');
      } catch (err) {
        console.error('[PROCESS ACCEPTANCE V4] Failed:', err);
      }
    }

    console.log('[PROCESS ACCEPTANCE V4] Completed successfully');

    return Response.json({
      success: true,
      accepted: true,
      message: 'Suggestion accepted successfully'
    });

  } catch (error) {
    console.error('[PROCESS ACCEPTANCE V4 ERROR]', error);

    if (lockAcquired && base44 && suggestionId) {
      try {
        await base44.asServiceRole.entities.Suggestion.updateMany(
          { id: suggestionId, status: 'pending', acceptanceLock: true },
          { $set: { acceptanceLock: false } }
        );
        console.log('[PROCESS ACCEPTANCE V4] Released acceptance lock after failure for', suggestionId);
      } catch (unlockError) {
        console.error('[PROCESS ACCEPTANCE V4] Failed to release acceptance lock:', unlockError);
      }
    }

    return Response.json({
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});