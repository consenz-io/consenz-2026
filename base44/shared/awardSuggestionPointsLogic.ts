/**
 * Shared logic for awarding gamification points when a suggestion is accepted.
 * 
 * Extracted from awardSuggestionPoints/entry.ts so that processAcceptance can
 * call it directly (without an HTTP round-trip) using its already-verified
 * service-role client. The HTTP endpoint wrapper adds authentication +
 * idempotency guards before delegating here.
 *
 * @param base44 - a service-role client (base44.asServiceRole from the caller)
 * @param suggestionId
 * @param action - 'suggestion_accepted' | 'topic_edit_accepted'
 */
export async function awardSuggestionPointsLogic(base44, { suggestionId, action, skipThresholdVerification }) {
  if (!suggestionId) {
    return { success: false, error: 'Missing suggestionId', status: 400 };
  }

  const suggestions = await base44.entities.Suggestion.filter({ id: suggestionId });
  if (suggestions.length === 0) {
    return { success: false, error: 'Suggestion not found', status: 404 };
  }
  const suggestion = suggestions[0];

  // Authorization guard: only award points for suggestions that have actually
  // been accepted through the consensus process. Without this check, any caller
  // could award 500 points to a creator by passing a pending/rejected suggestion ID.
  // Derive acceptance from the server-managed acceptedAt field (set only by
  // processAcceptance at acceptance time) rather than the client-writable
  // status field — Suggestion update RLS allows the creator to set status to
  // 'accepted' themselves, but they cannot set acceptedAt.
  if (suggestion.status !== 'accepted' || !suggestion.acceptedAt) {
    return { success: false, error: 'Suggestion is not accepted — points cannot be awarded', status: 403 };
  }

  const documents = await base44.entities.Document.filter({ id: suggestion.documentId });
  if (documents.length === 0 || !documents[0].gamificationEnabled) {
    return { success: true, message: 'Gamification not enabled' };
  }

  // ── Server-side consensus verification ──────────────────────────────────
  // The Suggestion.status field is client-writable (creator-scoped update RLS
  // allows setting it to any value), so checking status === 'accepted' alone is
  // not sufficient. When the caller has NOT already verified the threshold
  // (i.e. the HTTP endpoint or entity-automation handler), recount real Vote
  // records and verify the delta meets the document's threshold — exactly as
  // processAcceptanceV4 does. processAcceptance V1-V4 pass
  // skipThresholdVerification=true because they already verified server-side.
  if (!skipThresholdVerification) {
    const realVotes = await base44.entities.Vote.filter({ suggestionId });
    // Deduplicate by voter userId — Vote create RLS only requires userId ==
    // user.id, so a single voter can create multiple rows. Without dedup,
    // a user could fabricate apparent consensus and farm points.
    const votesByVoter = new Map();
    for (const v of realVotes) {
      if (!v.userId) continue;
      votesByVoter.set(v.userId, v);
    }
    const dedupedVotes = Array.from(votesByVoter.values());
    const realProVotes = dedupedVotes.filter(v => v.vote === 'pro').length;
    const realConVotes = dedupedVotes.filter(v => v.vote === 'con').length;
    const verifyDelta = realProVotes - realConVotes;
    const verifyThreshold = documents[0].threshold > 0 ? Math.max(2, documents[0].threshold) : 2;
    if (verifyDelta < verifyThreshold) {
      console.log('[AWARD POINTS] Threshold not met (delta:', verifyDelta, 'threshold:', verifyThreshold, ') — rejecting');
      return { success: false, error: 'Suggestion does not meet consensus threshold', status: 403 };
    }
  }

  const creatorId = suggestion.created_by_id;
  if (!creatorId) {
    return { success: false, error: 'No creator ID found', status: 404 };
  }

  // Derive the action server-side from the suggestion's own type rather than
  // trusting the caller-supplied value. The caller could otherwise alternate
  // the action parameter ('suggestion_accepted' then 'topic_edit_accepted') to
  // double-award points for the same accepted suggestion, since the idempotency
  // guard below is keyed on (relatedEntityId, userId, action). This function
  // only handles Suggestion entities (not TopicEditSuggestion), so the action is
  // always 'suggestion_accepted' regardless of what the caller passes.
  const resolvedAction = 'suggestion_accepted';
  const pointsAmount = 500;
  const description = `Your suggestion was accepted: ${suggestion.title || 'Suggestion'}`;

  // Idempotency: skip if points were already awarded for this suggestion + creator
  const existingTx = await base44.entities.PointsTransaction.filter({
    relatedEntityId: suggestionId,
    userId: creatorId,
    action: resolvedAction
  });
  if (existingTx.length > 0) {
    return { success: true, message: 'Points already awarded', skipped: true };
  }

  // 1. Award points to the suggestion CREATOR
  // Guard: creatorId may be a service-role UUID (not a valid ObjectId) if the
  // suggestion was created via a backend function using asServiceRole. In that
  // case we cannot look up the User entity — skip points gracefully.
  const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
  if (!isValidObjectId(creatorId)) {
    console.log('[AWARD POINTS] creatorId is not a valid ObjectId (likely service-role), skipping points:', creatorId);
    return { success: true, message: 'Creator is service role, no points to award', skipped: true };
  }
  const usersList = await base44.entities.User.filter({ id: creatorId });
  if (usersList.length === 0) {
    return { success: false, error: 'Creator user not found', status: 404 };
  }
  const creator = usersList[0];
  const newCreatorPoints = (creator.points || 1000) + pointsAmount;

  await Promise.all([
    base44.entities.User.update(creator.id, { points: newCreatorPoints }),
    base44.entities.PointsTransaction.create({
      userId: creator.id,
      amount: pointsAmount,
      action: resolvedAction,
      description,
      relatedEntityId: suggestionId,
      relatedEntityType: 'suggestion'
    })
  ]);

  console.log('[AWARD POINTS] ✓ Creator awarded', pointsAmount, 'points to user:', creator.id);

  // 2. Award 50 points to each PRO voter who influenced the acceptance
  if (resolvedAction === 'suggestion_accepted') {
    const votes = await base44.entities.Vote.filter({ suggestionId });
    // Deduplicate by voter — same dedup as the threshold check above.
    const voterMap = new Map();
    for (const v of votes) {
      if (!v.userId) continue;
      voterMap.set(v.userId, v);
    }
    const proVoterIds = Array.from(voterMap.values()).filter(v => v.vote === 'pro').map(v => v.userId).filter(Boolean);

    if (proVoterIds.length > 0) {
      const allUsers = await base44.entities.User.list();
      const proVoters = allUsers.filter(u => proVoterIds.includes(u.id) && u.id !== creator.id);

      for (const voter of proVoters) {
        // Idempotency per voter
        const existingVoterTx = await base44.entities.PointsTransaction.filter({
          relatedEntityId: suggestionId,
          userId: voter.id,
          action: 'vote_influenced_acceptance'
        });
        if (existingVoterTx.length > 0) continue;

        await Promise.all([
          base44.entities.User.update(voter.id, { points: (voter.points || 1000) + 50 }),
          base44.entities.PointsTransaction.create({
            userId: voter.id,
            amount: 50,
            action: 'vote_influenced_acceptance',
            description: `Your pro vote influenced acceptance: ${suggestion.title || 'Suggestion'}`,
            relatedEntityId: suggestionId,
            relatedEntityType: 'suggestion'
          })
        ]);
      }

      console.log('[AWARD POINTS] ✓ Awarded 50 points to pro voters');
    }
  }

  return { success: true };
}