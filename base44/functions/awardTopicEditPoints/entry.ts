import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { addPointsAtomic } from '../../shared/pointsOperations.ts';

// Awards points to the creator of a TopicEditSuggestion when a pro vote is
// cast (+10) or when the suggestion is accepted (+100). Replaces the
// insecure client-side pattern in useTopicVoteMutation that called
// User.update(creator.id, { points: computedValue }) — which let any user
// set any other user's points to any value.
//
// The function verifies the suggestion exists and determines the creator
// server-side. The award amount is fixed server-side per awardType (never
// trusted from the client).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { suggestionId, awardType } = body;
    if (!suggestionId || !awardType) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const AMOUNTS = {
      vote_received: 10,
      suggestion_accepted: 100,
    };
    const amount = AMOUNTS[awardType];
    if (!amount) return Response.json({ error: 'Invalid awardType' }, { status: 400 });

    const serviceBase44 = base44.asServiceRole;

    // Verify the suggestion exists and get the creator's email.
    const suggestions = await serviceBase44.entities.TopicEditSuggestion.filter({ id: suggestionId });
    const suggestion = suggestions[0];
    if (!suggestion) return Response.json({ error: 'Suggestion not found' }, { status: 404 });

    // For acceptance awards, verify the suggestion is actually accepted.
    if (awardType === 'suggestion_accepted' && suggestion.status !== 'accepted') {
      return Response.json({ error: 'Suggestion not accepted' }, { status: 400 });
    }

    // Find the creator user by email.
    const creatorUsers = await serviceBase44.entities.User.filter({ email: suggestion.created_by });
    const creator = creatorUsers[0];
    if (!creator) return Response.json({ success: true, message: 'Creator not found' });

    const description = awardType === 'vote_received'
      ? 'Received a pro vote on topic edit suggestion'
      : 'Topic edit suggestion accepted';

    await addPointsAtomic(
      serviceBase44,
      creator.id,
      amount,
      awardType,
      description,
      suggestionId,
      'topic'
    );

    return Response.json({ success: true, awarded: amount });
  } catch (error) {
    console.error('[AWARD TOPIC EDIT POINTS ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}