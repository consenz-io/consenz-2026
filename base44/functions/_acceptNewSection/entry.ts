import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Handles acceptance of a new_section suggestion.
 * Creates topic if needed, inserts section at the correct position,
 * shifts sibling sections/suggestions, creates DocumentVersion,
 * and converts the suggestion to type=edit_section.
 *
 * Input:  { suggestion, voterId, boundedConsensus, totalUsers, newThreshold, suggestionId }
 * Output: { success: true }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { suggestion, voterId, boundedConsensus, totalUsers, newThreshold, suggestionId } = await req.json();

    const detectLanguage = (text) => {
      if (!text) return 'he';
      if (/[\u0590-\u05FF]/.test(text)) return 'he';
      if (/[\u0600-\u06FF]/.test(text)) return 'ar';
      return 'en';
    };

    let targetTopicId = suggestion.topicId;

    if (!targetTopicId && suggestion.newTopicTitle) {
      const existingTopics = await base44.asServiceRole.entities.Topic.filter({ documentId: suggestion.documentId }, 'order');
      const maxOrder = existingTopics.length > 0 ? Math.max(...existingTopics.map(t => t.order || 0)) : -1;
      const newTopic = await base44.asServiceRole.entities.Topic.create({
        documentId: suggestion.documentId,
        title: suggestion.newTopicTitle,
        order: suggestion.newTopicOrder ?? (maxOrder + 1),
        originalLanguage: detectLanguage(suggestion.newTopicTitle)
      });
      targetTopicId = newTopic.id;
    }

    if (!targetTopicId) return Response.json({ error: 'No topicId' }, { status: 400 });

    const allSections = await base44.asServiceRole.entities.Section.filter(
      { documentId: suggestion.documentId, topicId: targetTopicId }, 'order'
    );
    const maxOrder = allSections.length > 0 ? Math.max(...allSections.map(s => s.order || 0)) : -1;

    let newOrder;
    const insertPosition = suggestion.insertPosition;
    if (insertPosition !== undefined && insertPosition !== null) {
      newOrder = insertPosition;
      const sectionsToShift = allSections.filter(s => s.order >= newOrder);
      if (sectionsToShift.length > 0) {
        await Promise.all(
          sectionsToShift.map(s => base44.asServiceRole.entities.Section.update(s.id, { order: s.order + 1 }))
        );

        // Shift insertPosition of other pending new_section suggestions in this topic
        const pendingNewSectionSuggs = await base44.asServiceRole.entities.Suggestion.filter({
          documentId: suggestion.documentId,
          topicId: targetTopicId,
          type: 'new_section',
          status: 'pending'
        });
        const suggsToShift = pendingNewSectionSuggs.filter(s =>
          s.id !== suggestionId &&
          s.insertPosition !== undefined && s.insertPosition !== null &&
          s.insertPosition !== -1 && s.insertPosition >= newOrder
        );
        if (suggsToShift.length > 0) {
          await Promise.all(
            suggsToShift.map(s =>
              base44.asServiceRole.entities.Suggestion.update(s.id, { insertPosition: s.insertPosition + 1 })
            )
          );
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
      topicId: targetTopicId,
      sectionOrder: newOrder,
      content: suggestion.newContent,
      changeDescription: suggestion.title || 'סעיף חדש',
      version: 1,
      changeType: 'section_created',
      suggestionId: suggestion.id,
      originalLanguage: newContentLanguage,
      translations: {}
    });

    // Convert suggestion to edit_section so it links to the created section
    await base44.asServiceRole.entities.Suggestion.update(suggestion.id, {
      type: 'edit_section',
      sectionId: newSection.id,
      status: 'accepted',
      originalContent: suggestion.newContent,
      suggestionConsensus: boundedConsensus,
      participantsAtAcceptance: totalUsers,
      threshold: newThreshold,
      parentSuggestionId: null
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});