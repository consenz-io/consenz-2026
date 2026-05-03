import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Handles acceptance of a delete_section suggestion.
 * 1. Records a final DocumentVersion snapshot of the section content before deletion.
 * 2. Deletes the section.
 * 3. Rejects orphaned suggestions targeting it.
 *
 * Input:  { suggestion, documentGamificationEnabled }
 * Output: { success: true }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { suggestion, documentGamificationEnabled } = await req.json();

    const section = await base44.asServiceRole.entities.Section.filter({ id: suggestion.sectionId }).then(r => r[0]);
    if (!section) return Response.json({ success: true, message: 'Section already deleted' });

    const versions = await base44.asServiceRole.entities.DocumentVersion.filter({ sectionId: section.id });
    const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;

    // Record a final snapshot of the content before it disappears (changeType marks it as deleted)
    await base44.asServiceRole.entities.DocumentVersion.create({
      documentId: suggestion.documentId,
      sectionId: section.id,
      topicId: section.topicId,
      sectionOrder: section.order,
      content: section.content,
      changeDescription: suggestion.title || 'מחיקת סעיף',
      version: nextVersion,
      changeType: 'suggestion_accepted',
      suggestionId: suggestion.id,
      originalLanguage: section.originalLanguage || 'he',
      translations: section.translations || {}
    });

    // Delete the section
    await base44.asServiceRole.entities.Section.delete(section.id);

    // Reject orphaned suggestions that targeted this section
    try {
      await base44.asServiceRole.functions.invoke('rejectOrphanedSuggestions', {
        sectionIds: [section.id],
        documentId: suggestion.documentId,
        gamificationEnabled: !!documentGamificationEnabled
      });
    } catch (orphanErr) {
      console.error('[ACCEPT DELETE SECTION] Failed to reject orphaned suggestions:', orphanErr);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[ACCEPT DELETE SECTION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});