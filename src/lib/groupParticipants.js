/**
 * Unified participant count calculation for a group.
 *
 * A "participant" is any unique userId who:
 *   1. Is a formal GroupMember of the group, OR
 *   2. Created a suggestion in any document belonging to the group, OR
 *   3. Voted on a suggestion in any group document, OR
 *   4. Commented in any group document, OR
 *   5. Signed a DocumentAgreement in any group document.
 *
 * All lookups go through UserPublicProfile (email → userId) to deduplicate
 * across the different activity types.
 *
 * @param {string}   groupId
 * @param {object[]} groupMembers      - all GroupMember records (or for this group)
 * @param {object[]} documents         - all Document records
 * @param {object[]} suggestions       - all Suggestion records
 * @param {object[]} votes             - all Vote records
 * @param {object[]} comments          - all Comment records
 * @param {object[]} publicProfiles    - all UserPublicProfile records
 * @param {object[]} agreements        - all DocumentAgreement records (optional)
 * @returns {number} count of unique participants
 */
export function calcGroupParticipants(
  groupId,
  groupMembers,
  documents,
  suggestions,
  votes,
  comments,
  publicProfiles,
  agreements = []
) {
  // Build email → userId map from public profiles
  const emailToUserId = new Map();
  publicProfiles.forEach(p => {
    if (p.email && p.userId) emailToUserId.set(p.email, p.userId);
  });

  const ids = new Set();

  // 1. Formal group members
  groupMembers
    .filter(m => m.groupId === groupId)
    .forEach(m => ids.add(m.userId));

  // Gather doc IDs for this group
  const groupDocIds = new Set(
    documents.filter(d => d.groupId === groupId).map(d => d.id)
  );
  if (groupDocIds.size === 0) return ids.size;

  // Gather suggestion IDs for those docs
  const groupSuggestionIds = new Set();
  suggestions.forEach(s => {
    if (groupDocIds.has(s.documentId)) {
      groupSuggestionIds.add(s.id);
      // 2. Suggestion creators
      if (s.created_by) {
        const uid = emailToUserId.get(s.created_by);
        if (uid) ids.add(uid);
      }
    }
  });

  // 3. Voters on group suggestions
  votes.forEach(v => {
    if (groupSuggestionIds.has(v.suggestionId) && v.userId) {
      ids.add(v.userId);
    }
  });

  // 4. Commenters in group docs / suggestions
  comments.forEach(c => {
    if (!c.created_by) return;
    const isInGroup =
      (c.rootEntityType === 'document'   && groupDocIds.has(c.rootEntityId)) ||
      (c.rootEntityType === 'suggestion' && groupSuggestionIds.has(c.rootEntityId));
    if (isInGroup) {
      const uid = emailToUserId.get(c.created_by);
      if (uid) ids.add(uid);
    }
  });

  // 5. DocumentAgreement signers
  agreements.forEach(a => {
    if (groupDocIds.has(a.documentId) && a.userId) {
      ids.add(a.userId);
    }
  });

  return ids.size;
}