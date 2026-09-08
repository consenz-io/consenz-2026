import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// One-time maintenance: backfills acceptedAt on legacy delete_section
// suggestions that were created before the field was added to voteOnSectionV2.
// Uses updated_date (falling back to created_date) as the acceptance timestamp.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const deletions = await base44.asServiceRole.entities.Suggestion.filter({
      type: 'delete_section',
      status: 'accepted'
    });

    const missing = deletions.filter(s => !s.acceptedAt);
    let updated = 0;
    let skipped = 0;

    for (const s of missing) {
      const stamp = s.updated_date || s.created_date;
      if (!stamp) {
        skipped++;
        continue;
      }
      try {
        await base44.asServiceRole.entities.Suggestion.update(s.id, { acceptedAt: stamp });
        updated++;
      } catch (e) {
        console.error('[backfillDeletionAcceptedAt] update failed for', s.id, e);
      }
    }

    return Response.json({
      totalDeletions: deletions.length,
      missingAcceptedAt: missing.length,
      updated,
      skipped
    });
  } catch (error) {
    console.error('[backfillDeletionAcceptedAt ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}