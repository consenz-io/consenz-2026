import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { addPointsAtomic } from '../../shared/pointsOperations.ts';

// Awards points to the creator of a TopicEditSuggestion when a pro vote is
// cast (+10) or when the suggestion is accepted (+100). Replaces the
// insecure client-side pattern in useTopicVoteMutation that called
// User.update(creator.id, { points: computedValue }) — which let any user
// set any other user's points to any value.
//
// Security:
// - The award amount is fixed server-side per awardType (never trusted from
//   the client).
// - For 'vote_received': verifies the calling user has a real pro
//   TopicEditVote record on this suggestion, and is idempotent per
//   (suggestionId, voterUserId) — one +10 per voter per suggestion.
// - For 'suggestion_accepted': recounts real TopicEditVote records and
//   verifies the delta meets the document's threshold (server-side consensus
//   verification — the suggestion status field is client-writable by the
//   creator, so status === 'accepted' alone is not sufficient), and is
//   idempotent per suggestionId — one +100 per accepted suggestion.
// - Gamification must be enabled on the document (verified server-side).
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

    // Verify gamification is enabled on the document — never trust the client.
    const docs = await serviceBase44.entities.Document.filter({ id: suggestion.documentId });
    if (docs.length === 0 || !docs[0].gamificationEnabled) {
      return Response.json({ success: true, message: 'Gamification not enabled' });
    }

    // Find the creator user by email.
    const creatorUsers = await serviceBase44.entities.User.filter({ email: suggestion.created_by });
    const creator = creatorUsers[0];
    if (!creator) return Response.json({ success: true, message: 'Creator not found' });

    if (awardType === 'vote_received') {
      // Verify the calling user has a real pro vote on this suggestion.
      const voterVotes = await serviceBase44.entities.TopicEditVote.filter({
        suggestionId, userId: user.id, vote: 'pro',
      });
      if (voterVotes.length === 0) {
        return Response.json({ error: 'No pro vote found for caller' }, { status: 403 });
      }

      // Idempotency: one +10 per (suggestionId, voterUserId) — keyed on the
      // voter, not the creator, so each pro vote awards the creator once.
      const existingTx = await serviceBase44.entities.PointsTransaction.filter({
        relatedEntityId: suggestionId,
        userId: creator.id,
        action: 'vote_received',
      });
      // Store the voter ID in the description to deduplicate per-voter.
      const voterKey = `vote_received:${user.id}`;
      const alreadyAwarded = existingTx.some(tx => tx.description?.includes(voterKey));
      if (alreadyAwarded) {
        return Response.json({ success: true, message: 'Points already awarded for this vote', skipped: true });
      }

      const description = `Received a pro vote on topic edit suggestion|${voterKey}`;
      await addPointsAtomic(
        serviceBase44,
        creator.id,
        amount,
        'vote_received',
        description,
        suggestionId,
        'topic'
      );
      return Response.json({ success: true, awarded: amount });
    }

    // awardType === 'suggestion_accepted'
    // Server-side consensus verification: recount real TopicEditVote records
    // (deduplicated by voter) and verify the delta meets the document's
    // threshold. The suggestion.status field is client-writable by the
    // creator (TopicEditSuggestion update RLS allows created_by_id), so
    // checking status === 'accepted' alone is not sufficient.
    const realVotes = await serviceBase44.entities.TopicEditVote.filter({ suggestionId });
    const votesByVoter = new Map();
    for (const v of realVotes) {
      if (!v.userId) continue;
      votesByVoter.set(v.userId, v);
    }
    const dedupedVotes = Array.from(votesByVoter.values());
    const realProVotes = dedupedVotes.filter(v => v.vote === 'pro').length;
    const realConVotes = dedupedVotes.filter(v => v.vote === 'con').length;
    const verifyDelta = realProVotes - realConVotes;
    const verifyThreshold = docs[0].threshold > 0 ? Math.max(2, docs[0].threshold) : 2;
    if (verifyDelta < verifyThreshold) {
      return Response.json({ error: 'Suggestion does not meet consensus threshold' }, { status: 403 });
    }

    // Idempotency: one +100 per accepted suggestion (keyed on suggestionId +
    // creator + action).
    const existingTx = await serviceBase44.entities.PointsTransaction.filter({
      relatedEntityId: suggestionId,
      userId: creator.id,
      action: 'suggestion_accepted',
    });
    if (existingTx.length > 0) {
      return Response.json({ success: true, message: 'Points already awarded', skipped: true });
    }

    const description = 'Topic edit suggestion accepted';
    await addPointsAtomic(
      serviceBase44,
      creator.id,
      amount,
      'suggestion_accepted',
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