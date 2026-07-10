import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * One-time migration: retroactively create delete_section suggestions for
 * section_deleted notifications that were created BEFORE the fix (those have
 * relatedEntityType='document' and actionUrl pointing to DocumentView).
 *
 * For each old notification:
 * 1. Find the deleted section's "before" version in DocumentVersion (changeType='section_deleted', non-empty content)
 * 2. Create a delete_section suggestion (status='accepted') with the section's original content
 * 3. Update the notification to point to the suggestion detail page
 *
 * Limitation: original SectionVote records were deleted at deletion time, so
 * vote counts cannot be recovered (set to 0).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    // Find ALL section_deleted notifications
    const allNotifs = await base44.asServiceRole.entities.Notification.filter({ type: 'section_deleted' });
    // Old format: relatedEntityType !== 'suggestion'
    const oldNotifs = allNotifs.filter(n => n.relatedEntityType !== 'suggestion');

    const results = { total: oldNotifs.length, migrated: 0, failed: 0, skipped: 0, details: [] };

    for (const notif of oldNotifs) {
      try {
        const documentId = notif.relatedEntityId;
        if (!documentId) { results.skipped++; continue; }

        // Find DocumentVersion "before" records for deleted sections in this document
        const versions = await base44.asServiceRole.entities.DocumentVersion.filter({
          documentId,
          changeType: 'section_deleted'
        });

        // The "before" record has non-empty content; the "deletion" record has empty content
        const beforeRecords = versions.filter(v => v.content && v.content.trim().length > 0);
        if (beforeRecords.length === 0) {
          results.skipped++;
          results.details.push({ notifId: notif.id, reason: 'no before-version found' });
          continue;
        }

        // Match by closest timestamp to the notification's created_date
        const notifTime = new Date(notif.created_date).getTime();
        beforeRecords.sort((a, b) =>
          Math.abs(new Date(a.created_date).getTime() - notifTime) -
          Math.abs(new Date(b.created_date).getTime() - notifTime)
        );
        const matched = beforeRecords[0];

        // Try to recover vote counts from SectionVote (unlikely — they're usually deleted)
        let proCount = 0;
        let conCount = 0;
        try {
          const remainingVotes = await base44.asServiceRole.entities.SectionVote.filter({ sectionId: matched.sectionId });
          proCount = remainingVotes.filter(v => v.vote === 'pro').length;
          conCount = remainingVotes.filter(v => v.vote === 'con').length;
        } catch (_e) { /* votes were cleaned up — counts stay 0 */ }

        if (dryRun) {
          results.details.push({
            notifId: notif.id,
            documentId,
            sectionId: matched.sectionId,
            hasContent: true,
            voteCounts: { pro: proCount, con: conCount }
          });
          continue;
        }

        // Create the delete_section suggestion
        const suggestion = await base44.asServiceRole.entities.Suggestion.create({
          documentId,
          sectionId: matched.sectionId,
          topicId: matched.topicId,
          originalSectionOrder: matched.sectionOrder,
          type: 'delete_section',
          title: 'מחיקת סעיף בהצבעת קהילה',
          originalContent: matched.content,
          newContent: '',
          explanation: '',
          status: 'accepted',
          proVotes: conCount, // pro = support deletion (SectionVote "con")
          conVotes: proCount, // con = oppose deletion (SectionVote "pro")
          timerEndsAt: null,
          originalLanguage: matched.originalLanguage || 'he',
          translations: {},
          participantsAtAcceptance: proCount + conCount,
        });

        // Update the notification to point to the suggestion
        await base44.asServiceRole.entities.Notification.update(notif.id, {
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl: `/suggestiondetail?id=${suggestion.id}`,
        });

        results.migrated++;
        results.details.push({ notifId: notif.id, suggestionId: suggestion.id, sectionId: matched.sectionId });
      } catch (e) {
        console.error('[MIGRATE] Failed for notification', notif.id, e);
        results.failed++;
        results.details.push({ notifId: notif.id, error: e.message });
      }
    }

    return Response.json({ success: true, dryRun, ...results });
  } catch (error) {
    console.error('[MIGRATE SECTION DELETED ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});