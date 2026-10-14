import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { spendPointsAtomic, POINTS_COSTS } from '../../shared/pointsOperations.ts';

// Creates a Suggestion AND atomically deducts the points cost server-side.
// Replaces the insecure client-side pattern where the app created the
// suggestion via the entity API and then deducted points via updateMe +
// PointsTransaction.create — which a user could bypass by calling the
// entity API directly (skipping the deduction entirely) or inflate by
// calling updateMe({ points: 999999 }).
//
// The cost is determined server-side from spendType (never trusted from
// the client), and gamificationEnabled is verified by reading the Document
// (not trusted from the client).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { suggestionData, pointsDescription } = body;

    if (!suggestionData || !suggestionData.documentId || !suggestionData.type || !suggestionData.title) {
      return Response.json({ error: 'Missing suggestion data' }, { status: 400 });
    }

    const serviceBase44 = base44.asServiceRole;

    // Derive the cost entirely server-side from suggestionData.type — never
    // trust a client-supplied spendType. Unknown types are rejected rather
    // than defaulting to 0 (which would let a caller bypass the points cost).
    const TYPE_COSTS = {
      new_section: POINTS_COSTS.new_section,       // 350
      edit_section: POINTS_COSTS.edit_section,     // 200
      edit_suggestion: POINTS_COSTS.edit_section,  // 200 — editing a suggestion is priced as an edit
      delete_section: 0,                           // free — proposing deletion does not cost points
    };
    if (!(suggestionData.type in TYPE_COSTS)) {
      return Response.json({ error: 'Invalid suggestion type' }, { status: 400 });
    }

    // Verify gamification setting server-side — never trust the client.
    const docs = await serviceBase44.entities.Document.filter({ id: suggestionData.documentId });
    const gamificationEnabled = docs.length > 0 && docs[0].gamificationEnabled;
    const cost = gamificationEnabled ? TYPE_COSTS[suggestionData.type] : 0;

    // Pre-check balance for an early, user-friendly error.
    if (cost > 0) {
      const users = await serviceBase44.entities.User.filter({ id: user.id });
      const currentPoints = users[0]?.points ?? 1000;
      if (currentPoints < cost) {
        return Response.json({ success: false, error: 'INSUFFICIENT_POINTS' });
      }
    }

    // Create the suggestion with the user-scoped client so created_by_id
    // is set to the actual user (needed for ownership, display, notifications).
    const suggestion = await base44.entities.Suggestion.create(suggestionData);

    // Atomic deduction with the real suggestion ID — conditional on
    // points still >= cost to handle concurrent spending races.
    if (cost > 0) {
      const spendResult = await spendPointsAtomic(
        serviceBase44,
        user.id,
        cost,
        'suggestion_created',
        pointsDescription || `Suggestion created: ${suggestionData.title}`,
        suggestion.id,
        'suggestion'
      );
      if (spendResult.error) {
        // Race: balance dropped between pre-check and deduction. Roll back
        // the suggestion so the user is not charged for something they can't afford.
        try { await serviceBase44.entities.Suggestion.delete(suggestion.id); } catch {}
        return Response.json({ success: false, error: spendResult.error });
      }
    }

    // Increment suggestionsCreated counter atomically (was client-side updateMe).
    await serviceBase44.entities.User.updateMany(
      { id: user.id },
      { $inc: { suggestionsCreated: 1 } }
    );

    return Response.json({ success: true, suggestion });
  } catch (error) {
    console.error('[CREATE SUGGESTION WITH POINTS ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}