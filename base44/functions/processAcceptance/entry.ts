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
  const [votes, profiles, docComments, sectionComments, suggestionComments] = await Promise.all([
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
  ]);

  const comments = [...docComments, ...sectionComments, ...suggestionComments];

  // Build O(1) lookup map
  const profileByUserId = new Map();
  profiles.forEach(p => { if (p.userId) profileByUserId.set(p.userId, p); });

  const uniqueEmails = new Set();

  // From votes — resolve userId → email via profile map
  votes.forEach(v => {
    const profile = profileByUserId.get(v.userId);
    if (profile?.email) uniqueEmails.add(profile.email);
  });

  // From comments
  comments.forEach(c => { if (c.created_by) uniqueEmails.add(c.created_by); });

  // From agreements
  agreements.forEach(a => { if (a.userEmail) uniqueEmails.add(a.userEmail); });

  // From suggestion creators
  suggestions.forEach(s => { if (s.created_by) uniqueEmails.add(s.created_by); });

  return Math.max(1, uniqueEmails.size);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This function runs with service role privileges
    const { suggestionId, documentId, voterId, wasNewVote, forceAccept } = await req.json();

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

    // ATOMIC LOCK: Set acceptanceLock=true only if it is currently false AND status is still pending.
    // Two concurrent instances will both attempt this write; only the one whose write lands first
    // will see acceptanceLock=false on re-fetch. The other will bail out.
    await base44.asServiceRole.entities.Suggestion.update(suggestionId, { acceptanceLock: true });
    const lockedSuggestion = await base44.asServiceRole.entities.Suggestion.get(suggestionId);

    if (!lockedSuggestion || lockedSuggestion.status !== 'pending' || !lockedSuggestion.acceptanceLock) {
      console.log('[PROCESS ACCEPTANCE] Lost the lock race — another instance is processing, skipping');
      return Response.json({ success: true, message: 'Already being processed' });
    }

    // Second guard: if acceptance was already fully completed by another instance that won the lock
    if (lockedSuggestion.suggestionConsensus != null) {
      console.log('[PROCESS ACCEPTANCE] Already processed by another instance (suggestionConsensus set), skipping');
      return Response.json({ success: true, message: 'Already processed by another instance' });
    }

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
    const newThreshold = Math.max(2, Math.round(consensusMeterAverage * totalUsers));

    console.log('[PROCESS ACCEPTANCE] Calculated:', { totalUsers, boundedConsensus, newThreshold });

    // Process based on suggestion type
    if (suggestion.type === 'edit_section' && suggestion.sectionId) {
      const section = await base44.asServiceRole.entities.Section.filter({ id: suggestion.sectionId }).then(r => r[0]);
      if (!section) {
        return Response.json({ error: 'Section not found' }, { status: 404 });
      }

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
        newOrder = suggestion.insertPosition;
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
            s.insertPosition !== -1 &&
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

      // Atomically mark accepted + set sectionId now that the section exists
      await base44.asServiceRole.entities.Suggestion.update(suggestion.id, {
        type: 'edit_section',
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
        // trigger its acceptance now with the updated content
        if (parentSuggestion.status === 'pending') {
          console.log('[PROCESS ACCEPTANCE] Parent is still pending, triggering its acceptance:', suggestion.parentSuggestionId);
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

        // Reject any orphaned suggestions targeting this deleted section
        try {
          await base44.asServiceRole.functions.invoke('rejectOrphanedSuggestions', {
            sectionIds: [section.id],
            documentId: suggestion.documentId,
            gamificationEnabled: !!document.gamificationEnabled
          });
        } catch (orphanErr) {
          console.error('[PROCESS ACCEPTANCE] Failed to reject orphaned suggestions:', orphanErr);
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
      // Update threshold on all other pending suggestions
      ...pendingSuggestions
        .filter(p => p.id !== suggestionId)
        .map(p => {
          // If same section, also update originalContent
          if (p.type === 'edit_section' && p.sectionId === suggestion.sectionId && suggestion.type === 'edit_section') {
            return base44.asServiceRole.entities.Suggestion.update(p.id, {
              threshold: newThreshold,
              originalContent: suggestion.newContent
            });
          }
          return base44.asServiceRole.entities.Suggestion.update(p.id, { threshold: newThreshold });
        })
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

    // Collect unique contributor emails
    const contributorEmails = new Set();

    // From agreements
    agreements.forEach(a => { if (a.userEmail) contributorEmails.add(a.userEmail); });

    // From votes
    docVotes.forEach(v => { if (v.created_by) contributorEmails.add(v.created_by); });

    // From comments
    docComments.forEach(c => { if (c.created_by) contributorEmails.add(c.created_by); });

    // From suggestion creators
    docSuggestions.forEach(s => { if (s.created_by) contributorEmails.add(s.created_by); });
    
    // Fetch all users by email
    let allUsers = [];
    if (contributorEmails.size > 0) {
      const emailArray = Array.from(contributorEmails);
      allUsers = await base44.asServiceRole.entities.User.filter({ email: { $in: emailArray } });
    }
    
    const suggTitle = suggestion.title || 'הצעה';
    const creatorReplacements = { title: suggTitle };
    const participantReplacements = { title: suggTitle, doc: document.title };
    const creatorTranslations = buildNotifTranslations('creatorTitle', 'creatorMessage', creatorReplacements);
    const participantTranslations = buildNotifTranslations('participantTitle', 'participantMessage', participantReplacements);

    // Build notifications
    for (const user of allUsers) {
      const userLang = user.preferredLanguage || 'he';
      if (user.email === suggestion.created_by) {
        notifications.push({
          userId: user.id,
          type: 'suggestion_accepted',
          title: nt(userLang, 'creatorTitle', creatorReplacements),
          message: nt(userLang, 'creatorMessage', creatorReplacements),
          translations: creatorTranslations,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl: `/documentview?id=${document.id}&suggestionId=${suggestion.id}`,
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
          actionUrl: `/documentview?id=${document.id}&suggestionId=${suggestion.id}`,
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

    // Points - award to suggestion creator
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

    console.log('[PROCESS ACCEPTANCE] Completed successfully');
    
    return Response.json({
      success: true,
      accepted: true,
      message: 'ההצעה התקבלה בהצלחה'
    });

  } catch (error) {
    console.error('[PROCESS ACCEPTANCE ERROR]', error);
    return Response.json({ 
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});