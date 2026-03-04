import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Detect language helper
const detectLanguage = (text) => {
  if (!text) return 'he';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

// Calculate contributors efficiently - single batch query
async function calculateContributors(base44, documentId) {
  const [suggestions, votes, comments, sections, agreements] = await Promise.all([
    base44.entities.Suggestion.filter({ documentId }),
    base44.entities.Vote.list(),
    base44.entities.Comment.list(),
    base44.entities.Section.filter({ documentId }),
    base44.entities.DocumentAgreement.filter({ documentId })
  ]);

  const uniqueEmails = new Set();
  
  // Collect from suggestion creators
  suggestions.forEach(s => {
    if (s.created_by) uniqueEmails.add(s.created_by);
  });
  
  // Collect from votes
  const suggestionIds = suggestions.map(s => s.id);
  votes.filter(v => suggestionIds.includes(v.suggestionId)).forEach(v => {
    if (v.created_by) uniqueEmails.add(v.created_by);
  });
  
  // Collect from comments
  const sectionIds = sections.map(s => s.id);
  comments.forEach(c => {
    if (c.created_by && (
      (c.rootEntityType === 'suggestion' && suggestionIds.includes(c.rootEntityId)) ||
      (c.rootEntityType === 'section' && sectionIds.includes(c.rootEntityId)) ||
      (c.rootEntityType === 'document' && c.rootEntityId === documentId)
    )) {
      uniqueEmails.add(c.created_by);
    }
  });
  
  // Collect from agreements
  agreements.forEach(a => {
    if (a.userEmail) uniqueEmails.add(a.userEmail);
  });
  
  return Math.max(1, uniqueEmails.size);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This function runs with service role privileges
    const { suggestionId, documentId, voterId, wasNewVote } = await req.json();

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

    // Double-check still pending
    if (suggestion.status !== 'pending') {
      console.log('[PROCESS ACCEPTANCE] Already processed, skipping');
      return Response.json({ success: true, message: 'Already processed' });
    }

    // Re-verify the suggestion actually meets the threshold (using stored document.threshold)
    const verifyDelta = (suggestion.proVotes || 0) - (suggestion.conVotes || 0);
    const verifyThreshold = Math.max(2, document.threshold || 2);
    if (verifyDelta < verifyThreshold) {
      console.log('[PROCESS ACCEPTANCE] Suggestion no longer meets threshold, aborting. delta:', verifyDelta, 'threshold:', verifyThreshold);
      return Response.json({ success: true, message: 'Threshold not met, acceptance aborted' });
    }

    // Calculate contributors and consensus
    const totalUsers = await calculateContributors(base44, documentId);
    
    const delta = (suggestion.proVotes || 0) - (suggestion.conVotes || 0);
    const sectionConsensus = (delta + totalUsers) / (2 * totalUsers);
    const boundedConsensus = Math.min(1, Math.max(0, sectionConsensus));

    // Update document consensus
    const updatedConsensuses = [...(document.consensuses || []), boundedConsensus];
    const consensusMeterAverage = updatedConsensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / updatedConsensuses.length;
    const newThreshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));

    console.log('[PROCESS ACCEPTANCE] Calculated:', { totalUsers, boundedConsensus, newThreshold });

    // Process based on suggestion type
    if (suggestion.type === 'edit_section' && suggestion.sectionId) {
      const section = await base44.entities.Section.filter({ id: suggestion.sectionId }).then(r => r[0]);
      if (!section) {
        return Response.json({ error: 'Section not found' }, { status: 404 });
      }

      const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;
      const newContentLanguage = detectLanguage(suggestion.newContent || '');

      // Create versions and update section
      await Promise.all([
        base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: section.content,
          changeDescription: `לפני: ${suggestion.title || 'הצעת עריכה'}`,
          version: nextVersion,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id
        }),
        base44.entities.Section.update(section.id, {
          content: suggestion.newContent,
          lastEditedBy: voterId,
          originalLanguage: newContentLanguage,
          translations: {}
        })
      ]);

      await base44.entities.DocumentVersion.create({
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
        const existingTopics = await base44.entities.Topic.filter({ documentId: suggestion.documentId }, 'order');
        const maxOrder = existingTopics.length > 0 ? Math.max(...existingTopics.map(t => t.order || 0)) : -1;
        const newTopicLanguage = detectLanguage(suggestion.newTopicTitle);
        
        const newTopic = await base44.entities.Topic.create({
          documentId: suggestion.documentId,
          title: suggestion.newTopicTitle,
          order: suggestion.newTopicOrder ?? (maxOrder + 1),
          originalLanguage: newTopicLanguage
        });
        targetTopicId = newTopic.id;
      }

      if (!targetTopicId) {
        return Response.json({ error: 'No topicId' }, { status: 400 });
      }

      const allSections = await base44.entities.Section.filter({ documentId: suggestion.documentId, topicId: targetTopicId }, 'order');
      const maxOrder = allSections.length > 0 ? Math.max(...allSections.map(s => s.order || 0)) : -1;
      const newOrder = suggestion.insertPosition ?? (maxOrder + 1);

      const newContentLanguage = detectLanguage(suggestion.newContent || '');
      const newSection = await base44.entities.Section.create({
        documentId: suggestion.documentId,
        topicId: targetTopicId,
        content: suggestion.newContent,
        order: newOrder,
        lastEditedBy: voterId,
        originalLanguage: newContentLanguage,
        translations: {}
      });

      await base44.entities.DocumentVersion.create({
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

      await base44.entities.Suggestion.update(suggestion.id, {
        type: 'edit_section',
        sectionId: newSection.id,
        status: 'accepted',
        originalContent: suggestion.newContent,
        suggestionConsensus: boundedConsensus,
        participantsAtAcceptance: totalUsers,
        threshold: newThreshold,
        parentSuggestionId: null
      });

    } else if (suggestion.type === 'delete_section' && suggestion.sectionId) {
      const section = await base44.entities.Section.filter({ id: suggestion.sectionId }).then(r => r[0]);
      if (section) {
        const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
        const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;

        await base44.entities.DocumentVersion.create({
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

        await base44.entities.Section.delete(section.id);
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

    if (suggestion.type !== 'new_section') {
      updates.push(
        base44.asServiceRole.entities.Suggestion.update(suggestion.id, {
          status: 'accepted',
          suggestionConsensus: boundedConsensus,
          participantsAtAcceptance: totalUsers,
          threshold: newThreshold
        })
      );
    }

    await Promise.all(updates);

    // Send notifications in batch - optimized single query
    console.log('[PROCESS ACCEPTANCE] Preparing notifications...');
    const notifications = [];
    
    // Fetch all data in one parallel query
    const [participants, creatorUsers] = await Promise.all([
      base44.entities.UserInteraction.filter({ documentId: document.id }),
      suggestion.created_by ? base44.asServiceRole.entities.User.filter({ email: suggestion.created_by }) : []
    ]);
    
    const participantUserIds = participants.map(p => p.userId).filter(Boolean);
    
    // Single query for all users (creator + participants)
    const allUserIds = [...new Set([
      ...(creatorUsers[0] ? [creatorUsers[0].id] : []),
      ...participantUserIds
    ])];
    
    const allUsers = allUserIds.length > 0 
      ? await base44.asServiceRole.entities.User.filter({ id: { $in: allUserIds } })
      : [];
    
    // Build notifications
    const creator = creatorUsers[0];
    if (creator) {
      notifications.push({
        userId: creator.id,
        type: 'suggestion_accepted',
        title: '🎉 ההצעה שלך התקבלה!',
        message: `ההצעה "${suggestion.title || 'הצעה'}" התקבלה ונוספה למסמך`,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl: `/document-view?id=${document.id}`,
        documentId: document.id,
        documentTitle: document.title
      });
    }
    
    // Participants
    for (const user of allUsers) {
      if (user.email === suggestion.created_by) continue;
      
      notifications.push({
        userId: user.id,
        type: 'suggestion_accepted',
        title: 'הצעה התקבלה במסמך',
        message: `ההצעה "${suggestion.title || 'הצעה'}" התקבלה במסמך "${document.title}"`,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl: `/document-view?id=${document.id}`,
        documentId: document.id,
        documentTitle: document.title
      });
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

    // Points - reuse creator from notifications query
    if (document.gamificationEnabled) {
      const pointsOperations = [];
      
      if (creator) {
        pointsOperations.push({
          userId: creator.id,
          amount: 200,
          action: 'suggestion_accepted',
          description: `ההצעה שלך התקבלה: ${suggestion.title || 'הצעה'}`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion'
        });
      }
      
      if (wasNewVote) {
        pointsOperations.push({
          userId: voterId,
          amount: 50,
          action: 'vote_influenced_acceptance',
          description: 'ההצבעה שלך השפיעה על קבלת ההצעה',
          relatedEntityId: suggestionId,
          relatedEntityType: 'suggestion'
        });
      }
      
      if (pointsOperations.length > 0) {
        setTimeout(() => {
          base44.asServiceRole.functions.invoke('pointsQueue', {
            operations: pointsOperations,
            processImmediate: true
          }).catch(err => console.error('[POINTS QUEUE]', err));
        }, 1000);
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