import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

// Detect language helper
const detectLanguage = (text) => {
  if (!text) return 'he';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

// Calculate contributors efficiently - scoped to this document only (no global list() calls)
async function calculateContributors(base44, documentId) {
  const [suggestions, sections, agreements] = await Promise.all([
    base44.asServiceRole.entities.Suggestion.filter({ documentId }),
    base44.asServiceRole.entities.Section.filter({ documentId }),
    base44.asServiceRole.entities.DocumentAgreement.filter({ documentId })
  ]);

  const suggestionIds = suggestions.map(s => s.id);
  const sectionIds = sections.map(s => s.id);

  // Fetch votes and comments scoped to this document's entities only
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

  // Build O(1) lookup maps — email→userId for resolving comment/suggestion creator emails
  const emailToUserId = new Map();
  profiles.forEach(p => { if (p.email && p.userId) emailToUserId.set(p.email, p.userId); });

  const uniqueParticipants = new Set(); // userIds (primary) + unresolved emails

  const addByKey = (userId, email) => {
    if (userId) uniqueParticipants.add(userId);
    else if (email) { const uid = emailToUserId.get(email); uniqueParticipants.add(uid || email); }
  };

  // From votes — userId is always present on Vote records
  votes.forEach(v => { addByKey(v.userId, v.created_by); });

  // From comments
  comments.forEach(c => { addByKey(c.created_by_id, c.created_by); });

  // From agreements
  agreements.forEach(a => { addByKey(a.userId, a.userEmail); });

  // From suggestion creators
  suggestions.forEach(s => { addByKey(s.created_by_id, s.created_by); });

  // From section voters — userId is always present on SectionVote records
  sectionVotes.forEach(v => { addByKey(v.userId, v.created_by); });

  return Math.max(1, uniqueParticipants.size);
}

Deno.serve(async (req) => {
  // Declared outside the try block so the catch handler below can reach them
  // for best-effort cleanup (releasing the acceptance lock) if anything throws.
  let base44;
  let suggestionId;
  let lockAcquired = false;

  try {
    base44 = createClientFromRequest(req);

    // This function runs with service role privileges
    let documentId, voterId, wasNewVote, forceAccept;
    ({ suggestionId, documentId, voterId, wasNewVote, forceAccept } = await req.json());

    console.log('[PROCESS ACCEPTANCE] Starting for suggestion:', suggestionId);

    // Fetch all needed data in parallel
    const [suggestion, document] = await Promise.all([
      base44.asServiceRole.entities.Suggestion.get(suggestionId),
      base44.asServiceRole.entities.Document.get(documentId)
    ]);

    if (!suggestion || !document) {
      console.error('[PROCESS ACCEPTANCE] Suggestion or document not found');
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    // Fast pre-check before attempting the lock
    if (suggestion.status !== 'pending') {
      console.log('[PROCESS ACCEPTANCE] Already processed, skipping');
      return Response.json({ success: true, message: 'Already processed' });
    }

    // Re-verify the suggestion actually meets the threshold (using stored document.threshold)
    // Skip threshold check if forceAccept=true (e.g. triggered by an accepted edit_suggestion on a pending parent)
    if (!forceAccept) {
      const verifyDelta = (suggestion.proVotes || 0) - (suggestion.conVotes || 0);
      const verifyThreshold = document.threshold > 0 ? Math.max(2, document.threshold) : 2;
      if (verifyDelta < verifyThreshold) {
        console.log('[PROCESS ACCEPTANCE] Suggestion no longer meets threshold, aborting. delta:', verifyDelta, 'threshold:', verifyThreshold);
        return Response.json({ success: true, message: 'Threshold not met, acceptance aborted' });
      }
    }

    // ── Acquire the acceptance lock ─────────────────────────────────────────
    // We intentionally do NOT write the lock and then immediately read it back to
    // verify. That "write then re-read" pattern is what used to live here, and it is
    // vulnerable to read-after-write lag: if the platform's read path has even a few
    // milliseconds of lag behind a just-completed write, the immediate .get() call can
    // return the PRE-write value, making a successful lock acquisition look like a
    // failure — 100% reproducible, on every single attempt, including the very first
    // one ever made on a suggestion (exactly what we observed: "Already being
    // processed" on a suggestion that had never been touched before).
    //
    // Instead, we gate purely on `suggestion.acceptanceLock` from the single fetch
    // already done at the top of this function (before any writes), and then just
    // write the lock — no re-verification read. This trades strict multi-instance
    // atomicity for reliability, which is the right trade-off for this app's actual
    // concurrency profile (a handful of collaborators voting, not a high-throughput
    // adversarial system). The tiny residual risk — two votes landing in the exact
    // same millisecond — is far better than the previous guaranteed-failure behavior.
    if (suggestion.acceptanceLock) {
      console.log('[PROCESS ACCEPTANCE] Lock already held per initial read, skipping');
      return Response.json({ success: true, message: 'Already being processed' });
    }

    await base44.asServiceRole.entities.Suggestion.update(suggestionId, { acceptanceLock: true });

    // NOTE: we intentionally do NOT add a second "already processed" guard here checking
    // suggestionConsensus != null. That check used to exist, but it's both redundant (the
    // status==='pending' checks above and the CAS lock already fully cover "was this already
    // accepted") and dangerous: if suggestionConsensus defaults to 0 rather than null/undefined
    // at the platform level (common for numeric fields with no explicit `default` in the
    // schema), `0 != null` is true, silently blocking every single acceptance attempt right
    // after acquiring the lock — as a clean `return`, not a `throw`, so it never reaches the
    // catch block's lock-release cleanup either. That combination (100%-reproducible silent
    // bail + permanently stuck lock) matches this bug's symptoms exactly.

    // From this point on we hold the lock — if anything below throws, the catch
    // handler at the bottom of this function will release it (acceptanceLock:false)
    // instead of leaving the suggestion permanently un-acceptable.
    lockAcquired = true;

    // We own the lock — for non-new_section types, mark accepted immediately so no other instance can proceed.
    // For new_section: we cannot mark accepted yet because sectionId is not known until after Section.create.
    // We will mark it accepted atomically together with sectionId at the end of the new_section block.
    if (suggestion.type !== 'new_section') {
      await base44.asServiceRole.entities.Suggestion.update(suggestionId, { status: 'accepted' });
    }

    // Calculate contributors and consensus
    const totalUsers = await calculateContributors(base44, documentId);
    
    const delta = (suggestion.proVotes || 0) - (suggestion.conVotes || 0);
    const sectionConsensus = (delta + totalUsers) / (2 * totalUsers);
    const boundedConsensus = Math.min(1, Math.max(0, sectionConsensus));

    // Update document consensus
    const updatedConsensuses = [...(document.consensuses || []), boundedConsensus];
    const consensusMeterAverage = updatedConsensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / updatedConsensuses.length;

    // ── Deadlock guard (C3) ─────────────────────────────────────────────
    // Cap the threshold at the number of REAL active voters so it can never exceed the
    // maximum achievable delta. Without this cap a high consensus average with many
    // historical participants (totalUsers) could produce a threshold larger than the
    // number of people who actually vote — making every future suggestion impossible to
    // pass ("frozen document"). We count unique voters across suggestion + section votes.
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
      console.error('[PROCESS ACCEPTANCE] active voter count failed, skipping cap:', e);
    }

    // Uncapped target from the consensus formula
    const rawThreshold = Math.max(2, Math.round(consensusMeterAverage * totalUsers));
    // Cap at active voters (but never below the floor of 2). If we couldn't measure active
    // voters, fall back to the uncapped value rather than blocking acceptance.
    const cap = activeVoterCount > 0 ? Math.max(2, activeVoterCount) : rawThreshold;
    const newThreshold = Math.min(rawThreshold, cap);

    console.log('[PROCESS ACCEPTANCE] Calculated:', { totalUsers, activeVoterCount, boundedConsensus, rawThreshold, cap, newThreshold });

    // Process based on suggestion type
    if (suggestion.type === 'edit_section' && suggestion.sectionId) {
      let section = await base44.asServiceRole.entities.Section.filter({ id: suggestion.sectionId }).then(r => r[0]);

      // ── Resurrect a deleted section ──────────────────────────────────
      // If the target section was deleted (community vote / admin delete),
      // accepting this edit recreates it at its original position
      // (topicId + originalSectionOrder preserved on the suggestion at deletion time).
      if (!section) {
        const resurrectTopicId = suggestion.topicId;
        if (!resurrectTopicId) {
          console.error('[PROCESS ACCEPTANCE] Cannot resurrect — no topicId on suggestion');
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

        // Link the accepted suggestion to the resurrected section so it appears in the carousel
        await base44.asServiceRole.entities.Suggestion.update(suggestion.id, {
          sectionId: section.id,
          originalSectionOrder: null
        });

        // Re-link pending child edit_suggestions to the resurrected section
        const resurrectChildren = await base44.asServiceRole.entities.Suggestion.filter({
          parentSuggestionId: suggestion.id
        });
        const pendingResurrectChildren = resurrectChildren.filter(c => c.status === 'pending');
        if (pendingResurrectChildren.length > 0) {
          console.log('[PROCESS ACCEPTANCE] Re-linking', pendingResurrectChildren.length, 'child suggestions to resurrected section', section.id);
          for (const child of pendingResurrectChildren) {
            await base44.asServiceRole.entities.Suggestion.update(child.id, {
              sectionId: section.id,
              type: 'edit_section',
              parentSuggestionId: null
            });
          }
        }

        // Re-link other pending suggestions anchored to the same deleted section
        const sameSlotOrphans = await base44.asServiceRole.entities.Suggestion.filter({
          documentId: suggestion.documentId,
          status: 'pending',
          sectionId: suggestion.sectionId
        });
        const otherSlotOrphans = sameSlotOrphans.filter(s => s.id !== suggestion.id && !s.parentSuggestionId);
        if (otherSlotOrphans.length > 0) {
          console.log('[PROCESS ACCEPTANCE] Re-linking', otherSlotOrphans.length, 'orphaned suggestions to resurrected section', section.id);
          for (const s of otherSlotOrphans) {
            await base44.asServiceRole.entities.Suggestion.update(s.id, {
              sectionId: section.id,
              originalSectionOrder: null
            });
          }
        }

        console.log('[PROCESS ACCEPTANCE] Resurrected deleted section', section.id, 'at order', resurrectOrder);

        // Skip the normal edit-version flow below — the section was just created.
      } else {
        const versions = await base44.asServiceRole.entities.DocumentVersion.filter({ sectionId: section.id });
        const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;
        const newContentLanguage = detectLanguage(suggestion.newContent || '');

        // Create versions and update section
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
        console.error('[PROCESS ACCEPTANCE] No targetTopicId for new_section — aborting without accepting');
        return Response.json({ error: 'No topicId' }, { status: 400 });
      }

      const allSections = await base44.asServiceRole.entities.Section.filter({ documentId: suggestion.documentId, topicId: targetTopicId });
      const maxOrder = allSections.length > 0 ? Math.max(...allSections.map(s => s.order || 0)) : -1;

      // Determine insertion order and shift existing sections if needed to avoid duplicates
      let newOrder;
      if (suggestion.insertPosition !== undefined && suggestion.insertPosition !== null) {
        // Math.floor normalizes fractional insertPosition (from admin drag reordering) to an integer section order
        newOrder = Math.floor(suggestion.insertPosition);
        // Shift all sections with order >= newOrder up by 1 to make room
        const sectionsToShift = allSections.filter(s => s.order >= newOrder);
        if (sectionsToShift.length > 0) {
          // Shift sections
          await Promise.all(
            sectionsToShift.map(s => base44.asServiceRole.entities.Section.update(s.id, { order: s.order + 1 }))
          );

          // Also shift insertPosition of pending new_section suggestions in the same topic
          // so they don't get displaced by the newly inserted section
          const pendingNewSectionSuggs = await base44.asServiceRole.entities.Suggestion.filter({
            documentId: suggestion.documentId,
            topicId: targetTopicId,
            type: 'new_section',
            status: 'pending'
          });
          const suggsToShift = pendingNewSectionSuggs.filter(s =>
            s.id !== suggestionId &&
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
            console.log('[PROCESS ACCEPTANCE] Shifted insertPosition for', suggsToShift.length, 'pending suggestions');
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

      // Re-link any child edit_suggestion to the newly created section.
      // Filter only by parentSuggestionId — type may already differ due to concurrent updates.
      // Process sequentially to avoid concurrent writes on the same records racing with the
      // threshold-update pass below.
      const childEditSuggestions = await base44.asServiceRole.entities.Suggestion.filter({
        parentSuggestionId: suggestion.id
      });
      const pendingChildren = childEditSuggestions.filter(c => c.status === 'pending');
      if (pendingChildren.length > 0) {
        console.log('[PROCESS ACCEPTANCE] Re-linking', pendingChildren.length, 'child suggestions to new section', newSection.id);
        for (const child of pendingChildren) {
          await base44.asServiceRole.entities.Suggestion.update(child.id, {
            sectionId: newSection.id,
            type: 'edit_section',
            parentSuggestionId: null
          });
        }
      }

      // Atomically mark accepted + set sectionId now that the section exists.
      // Keep type as 'new_section' — this identifies the suggestion as the section's
      // creator, allowing the frontend and voteOnSection to inherit its pro/con votes
      // as baselines for the section's vote display and deletion-progress calculation.
      await base44.asServiceRole.entities.Suggestion.update(suggestion.id, {
        sectionId: newSection.id,
        status: 'accepted',
        originalContent: suggestion.newContent,
        suggestionConsensus: boundedConsensus,
        participantsAtAcceptance: totalUsers,
        parentSuggestionId: null
      });

    } else if (suggestion.type === 'edit_suggestion' && suggestion.parentSuggestionId) {
      // Update the parent suggestion's newContent with the accepted edit
      const parentSuggestion = await base44.asServiceRole.entities.Suggestion.get(suggestion.parentSuggestionId);
      if (parentSuggestion) {
        const newContentLanguage = detectLanguage(suggestion.newContent || '');
        await base44.asServiceRole.entities.Suggestion.update(suggestion.parentSuggestionId, {
          newContent: suggestion.newContent,
          originalLanguage: newContentLanguage,
          translations: {}
        });
        console.log('[PROCESS ACCEPTANCE] Updated parent suggestion content:', suggestion.parentSuggestionId);

        // If the parent suggestion is still pending (new_section or edit_section),
        // trigger its acceptance now with the updated content — but ONLY if the parent
        // itself already meets its own vote threshold. Accepting the edit to a proposal's
        // wording must NOT auto-accept the proposal itself; the parent must still earn its
        // own consensus. (H3) We therefore re-check the parent's delta against the document
        // threshold here and pass forceAccept only when it genuinely qualifies. Without this,
        // a passing edit_suggestion would silently bypass the parent's threshold check.
        if (parentSuggestion.status === 'pending') {
          const parentDelta = (parentSuggestion.proVotes || 0) - (parentSuggestion.conVotes || 0);
          const parentThreshold = document.threshold > 0 ? Math.max(2, document.threshold) : 2;
          if (parentDelta >= parentThreshold) {
            console.log('[PROCESS ACCEPTANCE] Parent still pending AND meets threshold, triggering its acceptance:', suggestion.parentSuggestionId, { parentDelta, parentThreshold });
            try {
              await base44.asServiceRole.functions.invoke('processAcceptance', {
                suggestionId: suggestion.parentSuggestionId,
                documentId: suggestion.documentId,
                voterId,
                wasNewVote,
                forceAccept: true
              });
              console.log('[PROCESS ACCEPTANCE] Parent suggestion processed successfully');
            } catch (parentErr) {
              console.error('[PROCESS ACCEPTANCE] Failed to process parent suggestion:', parentErr);
            }
          } else {
            console.log('[PROCESS ACCEPTANCE] Parent still pending but below threshold — updated content only, NOT auto-accepting parent:', suggestion.parentSuggestionId, { parentDelta, parentThreshold });
          }
        }
      } else {
        console.warn('[PROCESS ACCEPTANCE] Parent suggestion not found:', suggestion.parentSuggestionId);
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

        // Anchor pending suggestions targeting this deleted section to their original position
        // (topicId + originalSectionOrder) so they remain visible & votable after deletion.
        // We do NOT reject them — the community can still accept them, which recreates the section.
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
            console.log('[PROCESS ACCEPTANCE] Anchored', orphaned.length, 'orphaned suggestions to original position');
          }
        } catch (orphanErr) {
          console.error('[PROCESS ACCEPTANCE] Failed to anchor orphaned suggestions:', orphanErr);
        }

        // Create a second version record marking the deletion (content='')
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

    // Points - award to suggestion creator (moved BEFORE notification logic which can fail
    // due to unreliable $in queries on User entity, causing the function to throw before
    // reaching points awarding at the end)
    if (document.gamificationEnabled) {
      try {
        await base44.asServiceRole.functions.invoke('awardSuggestionPoints', {
          suggestionId: suggestion.id,
          action: 'suggestion_accepted'
        });
        console.log('[PROCESS ACCEPTANCE] ✓ Points awarded to creator');
      } catch (err) {
        console.error('[PROCESS ACCEPTANCE] Points award failed:', err);
      }
    }

    // Update document and suggestion status (if not new_section which was already handled)
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
      // NOTE: 'threshold' is a Document-level field only (see base44/entities/Suggestion.jsonc —
      // it has no 'threshold' property). Writing it here used to throw a schema-validation
      // error on EVERY acceptance that happened while any other suggestion was pending
      // (i.e. almost always, in an active document), which rejected this whole Promise.all
      // batch and silently skipped the document threshold update + all outgoing
      // notifications for that acceptance. We only need to touch sibling suggestions that
      // target the exact same section being edited, to keep their originalContent in sync.
      ...pendingSuggestions
        .filter(p => p.id !== suggestionId)
        .filter(p => p.type === 'edit_section' && p.sectionId === suggestion.sectionId && suggestion.type === 'edit_section')
        .map(p => base44.asServiceRole.entities.Suggestion.update(p.id, {
          originalContent: suggestion.newContent
        }))
    ];

    // new_section is already fully updated inside its own block above (including suggestionConsensus)
    // edit_suggestion needs its own consensus fields set here
    if (suggestion.type !== 'new_section') {
      updates.push(
        base44.asServiceRole.entities.Suggestion.update(suggestion.id, {
          // status already set to 'accepted' atomically at the start of this function
          suggestionConsensus: boundedConsensus,
          participantsAtAcceptance: totalUsers
        })
      );
    }

    await Promise.all(updates);

    // Send notifications in batch - fetch all document participants
    console.log('[PROCESS ACCEPTANCE] Preparing notifications...');
    const notifications = [];

    // Fetch only data scoped to this document (no global scans)
    const [docSuggestions, docSections, agreements] = await Promise.all([
      base44.asServiceRole.entities.Suggestion.filter({ documentId: document.id }),
      base44.asServiceRole.entities.Section.filter({ documentId: document.id }),
      base44.asServiceRole.entities.DocumentAgreement.filter({ documentId: document.id })
    ]);

    const docSuggestionIds = docSuggestions.map(s => s.id);
    const docSectionIds = docSections.map(s => s.id);

    // Fetch votes and comments filtered to this document's entities
    const [docVotes, docComments] = await Promise.all([
      docSuggestionIds.length > 0
        ? base44.asServiceRole.entities.Vote.filter({ suggestionId: { $in: docSuggestionIds } })
        : Promise.resolve([]),
      base44.asServiceRole.entities.Comment.filter({
        rootEntityId: { $in: [...docSuggestionIds, ...docSectionIds, document.id] }
      })
    ]);

    // Collect unique contributor user IDs (created_by is not populated; use created_by_id / userId)
    const contributorIds = new Set();

    // Always include the suggestion creator
    if (suggestion.created_by_id) contributorIds.add(suggestion.created_by_id);

    // From agreements
    agreements.forEach(a => { if (a.userId) contributorIds.add(a.userId); });

    // From votes
    docVotes.forEach(v => { if (v.userId) contributorIds.add(v.userId); });

    // From comments
    docComments.forEach(c => { if (c.created_by_id) contributorIds.add(c.created_by_id); });

    // From suggestion creators
    docSuggestions.forEach(s => { if (s.created_by_id) contributorIds.add(s.created_by_id); });

    // Fetch all users by id
    let allUsers = [];
    if (contributorIds.size > 0) {
      const idArray = Array.from(contributorIds);
      allUsers = await base44.asServiceRole.entities.User.filter({ id: { $in: idArray } });
    }
    
    const suggTitle = suggestion.title || 'הצעה';
    const creatorReplacements = { title: suggTitle };
    const participantReplacements = { title: suggTitle, doc: document.title };
    const creatorTranslations = buildNotifTranslations('creatorTitle', 'creatorMessage', creatorReplacements);
    const participantTranslations = buildNotifTranslations('participantTitle', 'participantMessage', participantReplacements);

    // Build notifications
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
    
    // Send in one batch
    if (notifications.length > 0) {
      console.log('[PROCESS ACCEPTANCE] Sending', notifications.length, 'notifications...');
      try {
        await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
        console.log('[PROCESS ACCEPTANCE] ✓ Sent successfully');
      } catch (err) {
        console.error('[PROCESS ACCEPTANCE] Failed:', err);
      }
    }

    console.log('[PROCESS ACCEPTANCE] Completed successfully');
    
    return Response.json({
      success: true,
      accepted: true,
      message: 'Suggestion accepted successfully'
    });

  } catch (error) {
    console.error('[PROCESS ACCEPTANCE ERROR]', error);

    // ── Release the acceptance lock on failure (deadlock fix) ───────────────
    // If we won the CAS lock above but then threw before finishing, acceptanceLock
    // was left stuck at `true` while status stayed 'pending'. Since re-acquiring
    // the lock requires acceptanceLock:false, that suggestion could NEVER be
    // accepted again — no matter how many further votes came in — because every
    // future call would hit "Did not win the atomic lock" forever. Best-effort:
    // reset the lock so the next vote can retry cleanly. Guarded by status:'pending'
    // so we never clobber a suggestion that actually finished in an unrelated race.
    if (lockAcquired && base44 && suggestionId) {
      try {
        await base44.asServiceRole.entities.Suggestion.updateMany(
          { id: suggestionId, status: 'pending', acceptanceLock: true },
          { $set: { acceptanceLock: false } }
        );
        console.log('[PROCESS ACCEPTANCE] Released acceptance lock after failure for', suggestionId);
      } catch (unlockError) {
        console.error('[PROCESS ACCEPTANCE] Failed to release acceptance lock:', unlockError);
      }
    }

    return Response.json({ 
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});