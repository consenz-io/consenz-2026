import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Handles acceptance of a delete_section suggestion.
 * Creates a before-version record, deletes the section,
 * rejects orphaned suggestions targeting it, and records the deletion version.
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

    // Record the "before" snapshot
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

    // Record the deletion
    await base44.asServiceRole.entities.DocumentVersion.create({
      documentId: suggestion.documentId,
      sectionId: section.id,
      content: '',
      changeDescription: suggestion.title || 'מחיקת סעיף',
      version: nextVersion + 1,
      changeType: 'suggestion_accepted',
      suggestionId: suggestion.id
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});