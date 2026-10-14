import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { spendPointsAtomic, POINTS_COSTS } from '../../shared/pointsOperations.ts';

// Creates a TopicEditSuggestion AND atomically deducts the points cost
// server-side. Same security rationale as createSuggestionWithPoints —
// replaces the insecure client-side updateMe + PointsTransaction.create
// pattern in EditTopicModal.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { suggestionData, isAdmin, pointsDescription } = body;

    if (!suggestionData || !suggestionData.documentId || !suggestionData.topicId || !suggestionData.newTitle) {
      return Response.json({ error: 'Missing suggestion data' }, { status: 400 });
    }

    const serviceBase44 = base44.asServiceRole;

    // Verify gamification setting server-side. Admins skip the cost.
    let cost = 0;
    if (!isAdmin) {
      const docs = await serviceBase44.entities.Document.filter({ id: suggestionData.documentId });
      const gamificationEnabled = docs.length > 0 && docs[0].gamificationEnabled;
      cost = gamificationEnabled ? POINTS_COSTS.edit_topic : 0;
    }

    // Pre-check balance for an early, user-friendly error.
    if (cost > 0) {
      const users = await serviceBase44.entities.User.filter({ id: user.id });
      const currentPoints = users[0]?.points ?? 1000;
      if (currentPoints < cost) {
        return Response.json({ success: false, error: 'INSUFFICIENT_POINTS' });
      }
    }

    // Create the suggestion with the user-scoped client so created_by_id
    // is set to the actual user.
    const suggestion = await base44.entities.TopicEditSuggestion.create(suggestionData);

    // Atomic deduction with the real suggestion ID.
    if (cost > 0) {
      const spendResult = await spendPointsAtomic(
        serviceBase44,
        user.id,
        cost,
        'suggestion_created',
        pointsDescription || `Topic edit suggestion: ${suggestionData.newTitle}`,
        suggestion.id,
        'topic'
      );
      if (spendResult.error) {
        try { await serviceBase44.entities.TopicEditSuggestion.delete(suggestion.id); } catch {}
        return Response.json({ success: false, error: spendResult.error });
      }
    }

    // Increment suggestionsCreated counter atomically.
    if (cost > 0) {
      await serviceBase44.entities.User.updateMany(
        { id: user.id },
        { $inc: { suggestionsCreated: 1 } }
      );
    }

    return Response.json({ success: true, suggestion });
  } catch (error) {
    console.error('[CREATE TOPIC EDIT SUGGESTION WITH POINTS ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}