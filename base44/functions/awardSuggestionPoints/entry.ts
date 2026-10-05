import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { awardSuggestionPointsLogic } from '../../shared/awardSuggestionPointsLogic.ts';
import { authorizeInternalOrUser } from '../../shared/authGate.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    // Authorization: only admin or internal chain calls may trigger point
    // awards. Regular users could otherwise mint points by setting their own
    // suggestion's status to 'accepted' (permitted by Suggestion update RLS)
    // and invoking this endpoint. The legitimate acceptance flow calls
    // awardSuggestionPointsLogic directly from processAcceptance with the
    // internal token, not through this HTTP endpoint.
    const { ok, response } = await authorizeInternalOrUser(base44, body);
    if (!ok) return response;

    const { suggestionId, action } = body;

    // Delegate to shared logic (service role) with idempotency guard
    const result = await awardSuggestionPointsLogic(base44.asServiceRole, { suggestionId, action });

    if (result.status) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error('[AWARD POINTS ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});