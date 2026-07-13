/**
 * Unified participant count calculation for a group.
 *
 * A "participant" is any unique userId who:
 *   1. Is a formal GroupMember of the group, OR
 *   2. Created a suggestion in any document belonging to the group, OR
 *   3. Voted on a suggestion in any group document, OR
 *   4. Commented in any group document / suggestion / section, OR
 *   5. Signed a DocumentAgreement in any group document.
 *
 * All lookups go through UserPublicProfile (email → userId) to deduplicate
 * across the different activity types.
 *
 * @param {string}   groupId
 * @param {object[]} groupMembers      - GroupMember records
 * @param {object[]} documents         - Document records
 * @param {object[]} suggestions       - Suggestion records
 * @param {object[]} votes             - Vote records
 * @param {object[]} comments          - Comment records
 * @param {object[]} publicProfiles    - UserPublicProfile records
 * @param {object[]} agreements        - DocumentAgreement records (optional)
 * @param {object[]} sections          - Section records (optional, needed for section comments)
 * @param {object[]} sectionVotes      - SectionVote records (optional, section voters count as participants)
 * @returns {Set<string>} set of unique participant userIds
 */
export function calcGroupParticipants(
  groupId,
  groupMembers,
  documents,
  suggestions,
  votes,
  comments,
  publicProfiles,
  agreements = [],
  sections = [],
  sectionVotes = []
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
  if (groupDocIds.size === 0) return ids;

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

  // Gather section IDs for those docs (requires sections param)
  const groupSectionIds = new Set(
    sections.filter(s => groupDocIds.has(s.documentId)).map(s => s.id)
  );

  // 4. Commenters in group docs / suggestions / sections
  comments.forEach(c => {
    if (!c.created_by) return;
    const isInGroup =
      (c.rootEntityType === 'document'   && groupDocIds.has(c.rootEntityId)) ||
      (c.rootEntityType === 'suggestion' && groupSuggestionIds.has(c.rootEntityId)) ||
      (c.rootEntityType === 'section'    && groupSectionIds.has(c.rootEntityId));
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

  // 6. Section voters (users who voted on sections in group documents)
  sectionVotes.forEach(v => {
    if (groupSectionIds.has(v.sectionId) && v.userId) {
      ids.add(v.userId);
    }
  });

  return ids;
}

/**
 * Computes participant counts for ALL groups in a single pass.
 *
 * Calling calcGroupParticipants per group is O(groups × N) because it rebuilds
 * the email→userId map and re-iterates every suggestions/votes/comments/sections
 * array once per group. This version builds shared lookup maps once and does a
 * single pass over each array, giving O(N) total regardless of group count.
 *
 * @returns {Map<string, number>} groupId → participant count
 */
export function calcAllGroupParticipants(
  groups,
  groupMembers,
  documents,
  suggestions,
  votes,
  comments,
  publicProfiles,
  agreements = [],
  sections = [],
  sectionVotes = []
) {
  if (!groups || groups.length === 0) return new Map();

  // email → userId (built once)
  const emailToUserId = new Map();
  for (const p of publicProfiles) {
    if (p.email && p.userId) emailToUserId.set(p.email, p.userId);
  }

  // docId → groupId
  const docIdToGroupId = new Map();
  for (const d of documents) {
    if (d.groupId) docIdToGroupId.set(d.id, d.groupId);
  }

  // suggestionId → groupId (for vote matching)
  const suggestionIdToGroupId = new Map();
  // sectionId → groupId (for section-comment matching)
  const sectionIdToGroupId = new Map();

  // groupId → Set of participant userIds
  const groupParticipantSets = new Map();
  for (const g of groups) groupParticipantSets.set(g.id, new Set());

  // 1. Formal group members
  for (const m of groupMembers) {
    if (m.groupId && groupParticipantSets.has(m.groupId) && m.userId) {
      groupParticipantSets.get(m.groupId).add(m.userId);
    }
  }

  // 2. Suggestion creators + build suggestionId→groupId map
  for (const s of suggestions) {
    const gid = docIdToGroupId.get(s.documentId);
    if (!gid || !groupParticipantSets.has(gid)) continue;
    suggestionIdToGroupId.set(s.id, gid);
    if (s.created_by) {
      const uid = emailToUserId.get(s.created_by);
      if (uid) groupParticipantSets.get(gid).add(uid);
    }
  }

  // 3. Voters on group suggestions (O(1) lookup via suggestionId→groupId)
  for (const v of votes) {
    if (!v.userId) continue;
    const gid = suggestionIdToGroupId.get(v.suggestionId);
    if (gid && groupParticipantSets.has(gid)) {
      groupParticipantSets.get(gid).add(v.userId);
    }
  }

  // Build sectionId→groupId map
  for (const s of sections) {
    const gid = docIdToGroupId.get(s.documentId);
    if (gid) sectionIdToGroupId.set(s.id, gid);
  }

  // 4. Commenters (O(1) per comment via the three lookup maps)
  for (const c of comments) {
    if (!c.created_by) continue;
    let gid = null;
    if (c.rootEntityType === 'document') gid = docIdToGroupId.get(c.rootEntityId);
    else if (c.rootEntityType === 'suggestion') gid = suggestionIdToGroupId.get(c.rootEntityId);
    else if (c.rootEntityType === 'section') gid = sectionIdToGroupId.get(c.rootEntityId);
    if (gid && groupParticipantSets.has(gid)) {
      const uid = emailToUserId.get(c.created_by);
      if (uid) groupParticipantSets.get(gid).add(uid);
    }
  }

  // 5. DocumentAgreement signers
  for (const a of agreements) {
    if (!a.userId) continue;
    const gid = docIdToGroupId.get(a.documentId);
    if (gid && groupParticipantSets.has(gid)) {
      groupParticipantSets.get(gid).add(a.userId);
    }
  }

  // 6. Section voters (users who voted on sections in group documents)
  for (const v of sectionVotes) {
    if (!v.userId) continue;
    const gid = sectionIdToGroupId.get(v.sectionId);
    if (gid && groupParticipantSets.has(gid)) {
      groupParticipantSets.get(gid).add(v.userId);
    }
  }

  const result = new Map();
  groupParticipantSets.forEach((idSet, gid) => result.set(gid, idSet.size));
  return result;
}