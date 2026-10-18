import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { addPointsAtomic, POINTS_COSTS } from '../../shared/pointsOperations.ts';

// Server-side cost map — must match createSuggestionWithPoints exactly.
// The refund amount is derived from the suggestion type (server-owned state),
// NOT from the PointsTransaction record (which has open-create RLS and can be
// planted by any user with an arbitrary amount).
const TYPE_COSTS = {
  new_section: POINTS_COSTS.new_section,       // 350
  edit_section: POINTS_COSTS.edit_section,     // 200
  edit_suggestion: POINTS_COSTS.edit_section,  // 200 — editing a suggestion is priced as an edit
  delete_section: 0,                           // free — proposing deletion does not cost points
};

// Refunds the suggestion-creation cost to the creator when an admin rejects
// a suggestion. Replaces the insecure client-side pattern in SuggestionSidebar
// that read the PointsTransaction, computed newPoints, and wrote it via
// User.update(creator.id, { points: newPoints }) — which let any user set
// any other user's points to any value.
//
// AUTH: admin-only (rejection is an admin action). The refund amount is
// derived from the suggestion type via the server-side TYPE_COSTS map, not
// from the PointsTransaction amount (which any user can create with an
// arbitrary value). A PointsTransaction lookup is used only to VERIFY that
// points were actually spent — the transaction's amount must match the
// known server-set cost, so a client-planted record with a different amount
// (e.g. -999999) is rejected.
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

    // Find the suggestion to get the type and creator.
    const suggestions = await serviceBase44.entities.Suggestion.filter({ id: suggestionId });
    const suggestion = suggestions[0];
    if (!suggestion) return Response.json({ error: 'Suggestion not found' }, { status: 404 });

    // Derive the expected cost from the suggestion type via the server-side
    // cost map — never from a PointsTransaction record (open-create RLS).
    const expectedCost = TYPE_COSTS[suggestion.type] ?? 0;
    if (expectedCost <= 0) {
      return Response.json({ success: true, refundAmount: 0 });
    }

    // Verify points were actually spent: look for a PointsTransaction whose
    // amount matches the known server-set cost (-expectedCost). A client-
    // planted record with a different amount will not match and is ignored.
    // If gamification was off at creation time, no such transaction exists
    // and nothing is refunded.
    const transactions = await serviceBase44.entities.PointsTransaction.filter({
      relatedEntityId: suggestionId,
      action: 'suggestion_created',
      amount: -expectedCost,
    });
    if (transactions.length === 0) {
      return Response.json({ success: true, refundAmount: 0 });
    }

    // Find the creator user by email.
    const creatorUsers = await serviceBase44.entities.User.filter({ email: suggestion.created_by });
    const creator = creatorUsers[0];
    if (!creator) return Response.json({ success: true, refundAmount: 0, message: 'Creator not found' });

    await addPointsAtomic(
      serviceBase44,
      creator.id,
      expectedCost,
      'vote_canceled',
      `Refund for rejected suggestion: ${suggestion.title || ''}`,
      suggestionId,
      'suggestion'
    );

    return Response.json({ success: true, refundAmount: expectedCost });
  } catch (error) {
    console.error('[REFUND SUGGESTION POINTS ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}