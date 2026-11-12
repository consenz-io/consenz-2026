import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { authorizeInternalOrUser } from '../../shared/authGate.ts';
import { awardRejectionVotePoints } from '../../shared/rejectionVotePoints.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    // Auth: only the scheduled workflow trigger (internal token) or an admin
    // may invoke this maintenance function. Previously any anonymous caller
    // could run it since the check only rejected authenticated non-admins.
    const authUser = await base44.auth.me().catch(() => null);
    const { ok, response } = await authorizeInternalOrUser(base44, body, authUser);
    if (!ok) return response;
    const now = new Date().toISOString();
    console.log('[EXPIRE SUGGESTIONS] Running at:', now);

    const pendingSuggestions = await base44.asServiceRole.entities.Suggestion.filter({ status: 'pending' });
    console.log('[EXPIRE SUGGESTIONS] Total pending:', pendingSuggestions.length);

    const expired = pendingSuggestions.filter(s => s.timerEndsAt && new Date(s.timerEndsAt) <= new Date());
    console.log('[EXPIRE SUGGESTIONS] Expired:', expired.length);

    if (expired.length === 0) {
      return Response.json({ success: true, expired: 0 });
    }

    // Process expired suggestions sequentially to avoid quota burst
    let processedCount = 0;
    for (const suggestion of expired) {
      console.log('[EXPIRE SUGGESTIONS] Expiring:', suggestion.id, suggestion.title);

      // Fetch the document BEFORE rejecting so we can freeze the acceptance
      // threshold at rejection time. The progress bar on a rejected suggestion
      // shows this frozen threshold instead of the live document.threshold,
      // which may have changed by the time the user views the rejected card.
      let rejectionThreshold = 2;
      try {
        const docs = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId });
        if (docs[0]?.threshold != null) rejectionThreshold = docs[0].threshold;
      } catch (docErr) {
        console.error('[EXPIRE SUGGESTIONS] Failed to fetch document for threshold:', docErr.message);
      }

      // ── Race guard vs processAcceptance (H2) ──────────────────────────
      // Only expire a suggestion that is STILL pending AND NOT currently locked for
      // acceptance. This mirrors processAcceptance's own lock: if processAcceptance
      // already won the lock (acceptanceLock:true) or already accepted it
      // (status != pending), the conditional update below won't apply to this row.
      //
      // We verify by reading the record back afterward rather than trusting a guessed
      // field name (modifiedCount/modified/count) on updateMany's return value — if that
      // guess doesn't match this SDK's actual response shape, it silently resolves to 0
      // on every call and NO suggestion would ever expire, with no error ever logged.
      await base44.asServiceRole.entities.Suggestion.updateMany(
        { id: suggestion.id, status: 'pending', acceptanceLock: false },
        { $set: { status: 'rejected', rejectedByAdmin: false, thresholdAtRejection: rejectionThreshold } }
      );
      const rejectedSuggestion = await base44.asServiceRole.entities.Suggestion.get(suggestion.id);
      if (!rejectedSuggestion || rejectedSuggestion.status !== 'rejected') {
        console.log('[EXPIRE SUGGESTIONS] Skipping — acceptance in progress or already resolved:', suggestion.id);
        continue;
      }

      const votes = await base44.asServiceRole.entities.Vote.filter({ suggestionId: suggestion.id });

      // Collect recipient userIds
      const recipientUserIds = new Set();

      if (suggestion.created_by_id) {
        recipientUserIds.add(suggestion.created_by_id);
      }

      votes.forEach(v => { if (v.userId) recipientUserIds.add(v.userId); });

      // Send notifications sequentially
      for (const userId of recipientUserIds) {
        const isCreator = userId === suggestion.created_by_id;
        await base44.asServiceRole.entities.Notification.create({
          userId,
          type: 'suggestion_expiring',
          title: isCreator ? 'ההצעה שלך פגה תוקף' : 'הצעה פגה תוקף',
          message: `"${suggestion.title || 'הצעה'}" לא קיבלה מספיק תמיכה בזמן הקצוב ונדחתה.`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          read: false,
          actionUrl: `/suggestiondetail?id=${suggestion.id}`
        });
      }

      console.log('[EXPIRE SUGGESTIONS] Done:', suggestion.id, 'notified', recipientUserIds.size);

      // Expiry is a rejection — the opposing voters are rewarded for it.
      await awardRejectionVotePoints(
        base44.asServiceRole,
        { ...suggestion, status: 'rejected' }
      );

      processedCount++;
    }

    return Response.json({ success: true, expired: processedCount });
  } catch (error) {
    console.error('[EXPIRE SUGGESTIONS ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});