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
export async function awardSuggestionPointsLogic(base44, { suggestionId, action }) {
  if (!suggestionId) {
    return { success: false, error: 'Missing suggestionId', status: 400 };
  }

  const suggestions = await base44.entities.Suggestion.filter({ id: suggestionId });
  if (suggestions.length === 0) {
    return { success: false, error: 'Suggestion not found', status: 404 };
  }
  const suggestion = suggestions[0];

  const documents = await base44.entities.Document.filter({ id: suggestion.documentId });
  if (documents.length === 0 || !documents[0].gamificationEnabled) {
    return { success: true, message: 'Gamification not enabled' };
  }

  const creatorId = suggestion.created_by_id;
  if (!creatorId) {
    return { success: false, error: 'No creator ID found', status: 404 };
  }

  let pointsAmount = 0;
  let description = '';

  if (action === 'suggestion_accepted') {
    pointsAmount = 500;
    description = `Your suggestion was accepted: ${suggestion.title || 'Suggestion'}`;
  } else if (action === 'topic_edit_accepted') {
    pointsAmount = 100;
    description = `Your topic title edit was accepted`;
  } else {
    return { success: false, error: 'Invalid action', status: 400 };
  }

  // Idempotency: skip if points were already awarded for this suggestion + action + creator
  const existingTx = await base44.entities.PointsTransaction.filter({
    relatedEntityId: suggestionId,
    userId: creatorId,
    action
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
      action,
      description,
      relatedEntityId: suggestionId,
      relatedEntityType: action === 'topic_edit_accepted' ? 'topic' : 'suggestion'
    })
  ]);

  console.log('[AWARD POINTS] ✓ Creator awarded', pointsAmount, 'points to user:', creator.id);

  // 2. Award 50 points to each PRO voter who influenced the acceptance
  //    (only for suggestion_accepted, not topic_edit_accepted)
  if (action === 'suggestion_accepted') {
    const votes = await base44.entities.Vote.filter({ suggestionId });
    const proVoterIds = votes.filter(v => v.vote === 'pro').map(v => v.userId).filter(Boolean);

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