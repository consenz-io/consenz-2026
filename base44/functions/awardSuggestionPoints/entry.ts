import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { awardSuggestionPointsLogic } from '../../shared/awardSuggestionPointsLogic.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate the caller — prevents unauthenticated arbitrary point grants
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { suggestionId, action } = await req.json();

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