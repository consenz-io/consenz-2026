import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { awardSuggestionPointsLogic } from '../../shared/awardSuggestionPointsLogic.ts';
import { INTERNAL_AUTOMATION_TOKEN } from '../../shared/internalToken.ts';

/**
 * Entity automation handler — fires when a Suggestion's status changes to "accepted".
 * V2: Same logic as awardPointsOnAcceptance but with auth check (internal token or admin).
 *
 * AUTH: Requires internal automation token (via function_args) or admin user.
 * Anonymous external callers are rejected with 401.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: true, message: 'No body' });
    }

    const { event, data, payload_too_large, args = {} } = body || {};

    // Auth: allow the internal automation (token via function_args) or an admin.
    // External anonymous callers are rejected with 401.
    const user = await base44.auth.me().catch(() => null);
    const isInternalAutomation = args.internalToken === INTERNAL_AUTOMATION_TOKEN;
    if (!isInternalAutomation && user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only handle update events on Suggestion entity
    if (event?.type !== 'update' || event?.entity_name !== 'Suggestion') {
      return Response.json({ success: true, message: 'Not a suggestion update' });
    }

    const suggestionId = event?.entity_id;
    if (!suggestionId) {
      return Response.json({ success: true, message: 'No entity_id' });
    }

    // If payload was too large, fetch the suggestion
    let suggestion = data;
    if (payload_too_large || !suggestion) {
      try {
        suggestion = await base44.asServiceRole.entities.Suggestion.get(suggestionId);
      } catch {
        return Response.json({ success: true, message: 'Could not fetch suggestion' });
      }
    }

    // Only proceed if the suggestion is accepted
    if (!suggestion || suggestion.status !== 'accepted') {
      return Response.json({ success: true, message: 'Suggestion not accepted' });
    }

    // Skip admin-approved suggestions (excluded from consensus)
    if (suggestion.approvedByAdmin) {
      return Response.json({ success: true, message: 'Admin-approved, skipping' });
    }

    // Delegate to shared logic — has idempotency guard, safe to call multiple times
    const result = await awardSuggestionPointsLogic(base44.asServiceRole, {
      suggestionId,
      action: 'suggestion_accepted'
    });

    console.log('[AWARD ON ACCEPTANCE V2] Suggestion:', suggestionId, 'Result:', result);
    return Response.json({ success: true, result });
  } catch (error) {
    console.error('[AWARD ON ACCEPTANCE V2 ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});