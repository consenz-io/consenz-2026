import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Handles acceptance of an edit_section suggestion.
 * 1. Updates the Section with new content.
 * 2. Creates a single DocumentVersion record capturing the new state.
 *
 * Input:  { suggestion, voterId }
 * Output: { success: true }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { suggestion, voterId } = await req.json();

    const detectLanguage = (text) => {
      if (!text) return 'he';
      if (/[\u0590-\u05FF]/.test(text)) return 'he';
      if (/[\u0600-\u06FF]/.test(text)) return 'ar';
      return 'en';
    };

    const section = await base44.asServiceRole.entities.Section.filter({ id: suggestion.sectionId }).then(r => r[0]);
    if (!section) return Response.json({ error: 'Section not found' }, { status: 404 });

    // Calculate next version number sequentially
    const versions = await base44.asServiceRole.entities.DocumentVersion.filter({ sectionId: section.id });
    const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;
    const newContentLanguage = detectLanguage(suggestion.newContent || '');

    // Update section first, then record the new version — sequential to guarantee correct created_date order
    await base44.asServiceRole.entities.Section.update(section.id, {
      content: suggestion.newContent,
      lastEditedBy: voterId,
      originalLanguage: newContentLanguage,
      translations: {}
    });

    await base44.asServiceRole.entities.DocumentVersion.create({
      documentId: suggestion.documentId,
      sectionId: section.id,
      topicId: section.topicId,
      sectionOrder: section.order,
      content: suggestion.newContent,
      changeDescription: suggestion.title || 'הצעת עריכה',
      version: nextVersion,
      changeType: 'suggestion_accepted',
      suggestionId: suggestion.id,
      originalLanguage: newContentLanguage,
      translations: {}
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[ACCEPT EDIT SECTION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});