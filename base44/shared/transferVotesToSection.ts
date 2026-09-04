/**
 * Transfers all votes (pro and con) from a suggestion to the section it created/updated.
 *
 * When a suggestion is accepted, the resulting section should inherit the community's
 * voting data — both pro and con votes — so the section reflects the same democratic
 * consensus that accepted the suggestion.
 *
 * @param base44    - The base44 client (with asServiceRole access)
 * @param suggestionId - The accepted suggestion whose votes should be transferred
 * @param sectionId - The section that was created or updated
 * @param replace   - If true, deletes existing SectionVote records for the section
 *                    before creating new ones (used for edit_section where the section
 *                    already had votes). If false, just creates new votes (used for
 *                    new_section where the section is brand new).
 */
export async function transferVotesToSection(base44, suggestionId, sectionId, replace = false) {
  if (!suggestionId || !sectionId) {
    console.warn('[TRANSFER VOTES] Missing suggestionId or sectionId, skipping');
    return;
  }

  try {
    // Fetch all votes on the suggestion
    const votes = await base44.asServiceRole.entities.Vote.filter({ suggestionId });

    if (replace) {
      // Delete existing section votes for this section (the section's previous votes
      // are replaced by the suggestion's votes, since the content now represents
      // the accepted suggestion's content)
      const existingSectionVotes = await base44.asServiceRole.entities.SectionVote.filter({ sectionId });
      if (existingSectionVotes.length > 0) {
        await Promise.all(
          existingSectionVotes.map(sv => base44.asServiceRole.entities.SectionVote.delete(sv.id))
        );
        console.log('[TRANSFER VOTES] Deleted', existingSectionVotes.length, 'existing section votes for section', sectionId);
      }
    }

    // Create new section votes from the suggestion's votes
    if (votes.length > 0) {
      const sectionVotes = votes.map(v => ({
        sectionId,
        userId: v.userId,
        vote: v.vote,
      }));
      await base44.asServiceRole.entities.SectionVote.bulkCreate(sectionVotes);
    }

    console.log('[TRANSFER VOTES] Transferred', votes.length, 'votes from suggestion', suggestionId, 'to section', sectionId);
  } catch (error) {
    console.error('[TRANSFER VOTES] Error transferring votes:', error);
    // Non-fatal — the acceptance itself already succeeded; vote transfer is a bonus
  }
}