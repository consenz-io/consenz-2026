/**
 * Rejection-side mirror of the acceptance award.
 *
 * A suggestion can be rejected three ways: an admin rejects it, its voting time
 * runs out, or the section it edited was deleted. In all three cases every
 * participant who voted AGAINST it gets 50 points — the same reward a pro voter
 * gets when a suggestion is accepted. The creator is excluded, exactly as on
 * the acceptance side.
 *
 * Idempotent per (suggestion, voter): a suggestion that is reopened and
 * rejected again never pays twice. Uses `vote_influenced_rejection` so the
 * points history can tell a rejection reward from an acceptance reward.
 */
export const REJECTION_VOTE_POINTS = 50;

export async function awardRejectionVotePoints(base44, suggestion, document) {
  try {
    if (!suggestion?.id) return { awarded: 0 };

    let doc = document;
    if (!doc) {
      const docs = await base44.entities.Document.filter({ id: suggestion.documentId });
      doc = docs[0];
    }
    if (!doc?.gamificationEnabled) return { awarded: 0 };

    const votes = await base44.entities.Vote.filter({ suggestionId: suggestion.id });
    // Deduplicate by voter — Vote create RLS only requires userId == user.id, so
    // one voter can create several rows for the same suggestion.
    const conVoterIds = new Set();
    for (const vote of votes) {
      if (!vote.userId || vote.vote !== 'con') continue;
      if (vote.userId === suggestion.created_by_id) continue; // never the creator
      conVoterIds.add(vote.userId);
    }
    if (conVoterIds.size === 0) return { awarded: 0 };

    // Fetch all users and filter in code — the platform does not reliably
    // support $in on the User entity.
    const allUsers = await base44.entities.User.list();

    let awarded = 0;
    for (const userId of conVoterIds) {
      const voter = allUsers.find((u) => u.id === userId);
      if (!voter) continue;

      const existing = await base44.entities.PointsTransaction.filter({
        relatedEntityId: suggestion.id,
        userId,
        action: 'vote_influenced_rejection',
      });
      if (existing.length > 0) continue;

      await Promise.all([
        base44.entities.User.update(voter.id, {
          points: (voter.points || 1000) + REJECTION_VOTE_POINTS,
        }),
        base44.entities.PointsTransaction.create({
          userId,
          amount: REJECTION_VOTE_POINTS,
          action: 'vote_influenced_rejection',
          description: `הצבעתך השפיעה על דחיית ההצעה: ${suggestion.title || ''}`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl: `/suggestiondetail?id=${suggestion.id}`,
        }),
      ]);
      awarded++;
    }

    console.log('[REJECTION VOTE POINTS] Awarded', REJECTION_VOTE_POINTS, 'to', awarded, 'con voters for', suggestion.id);
    return { awarded };
  } catch (error) {
    // Points must never break the rejection itself.
    console.error('[REJECTION VOTE POINTS ERROR]', error.message);
    return { awarded: 0, error: error.message };
  }
}