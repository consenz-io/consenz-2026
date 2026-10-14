import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { addPointsAtomic } from '../../shared/pointsOperations.ts';

// Refunds the suggestion-creation cost to the creator when an admin rejects
// a suggestion. Replaces the insecure client-side pattern in SuggestionSidebar
// that read the PointsTransaction, computed newPoints, and wrote it via
// User.update(creator.id, { points: newPoints }) — which let any user set
// any other user's points to any value.
//
// AUTH: admin-only (rejection is an admin action). The refund amount is
// derived from the original server-created PointsTransaction, not from
// client-supplied input.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { suggestionId } = body;
    if (!suggestionId) return Response.json({ error: 'Missing suggestionId' }, { status: 400 });

    const serviceBase44 = base44.asServiceRole;

    // Find the original suggestion_created transaction to get the cost.
    const transactions = await serviceBase44.entities.PointsTransaction.filter({
      relatedEntityId: suggestionId,
      action: 'suggestion_created',
    });
    const originalTransaction = transactions[0];
    const refundAmount = originalTransaction ? Math.abs(originalTransaction.amount) : 0;

    if (refundAmount <= 0) {
      return Response.json({ success: true, refundAmount: 0 });
    }

    // Find the suggestion to get the creator's email.
    const suggestions = await serviceBase44.entities.Suggestion.filter({ id: suggestionId });
    const suggestion = suggestions[0];
    if (!suggestion) return Response.json({ error: 'Suggestion not found' }, { status: 404 });

    // Find the creator user by email.
    const creatorUsers = await serviceBase44.entities.User.filter({ email: suggestion.created_by });
    const creator = creatorUsers[0];
    if (!creator) return Response.json({ success: true, refundAmount: 0, message: 'Creator not found' });

    await addPointsAtomic(
      serviceBase44,
      creator.id,
      refundAmount,
      'vote_canceled',
      `Refund for rejected suggestion: ${suggestion.title || ''}`,
      suggestionId,
      'suggestion'
    );

    return Response.json({ success: true, refundAmount });
  } catch (error) {
    console.error('[REFUND SUGGESTION POINTS ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}