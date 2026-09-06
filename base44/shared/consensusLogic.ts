// Shared consensus calculation logic.
// Used by voteOnSection (community-voted section deletion) to update the
// document's consensus meter + threshold identically to processAcceptanceV2
// (suggestion acceptance), so both acceptance paths keep the meter in sync.

export async function calculateContributors(base44, documentId) {
  const [suggestions, sections, agreements] = await Promise.all([
    base44.asServiceRole.entities.Suggestion.filter({ documentId }),
    base44.asServiceRole.entities.Section.filter({ documentId }),
    base44.asServiceRole.entities.DocumentAgreement.filter({ documentId })
  ]);

  const suggestionIds = suggestions.map(s => s.id);
  const sectionIds = sections.map(s => s.id);

  const [votes, profiles, docComments, sectionComments, suggestionComments, sectionVotes] = await Promise.all([
    suggestionIds.length > 0
      ? base44.asServiceRole.entities.Vote.filter({ suggestionId: { $in: suggestionIds } })
      : Promise.resolve([]),
    base44.asServiceRole.entities.UserPublicProfile.list(),
    base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'document', rootEntityId: documentId }),
    sectionIds.length > 0
      ? base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'section', rootEntityId: { $in: sectionIds } })
      : Promise.resolve([]),
    suggestionIds.length > 0
      ? base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'suggestion', rootEntityId: { $in: suggestionIds } })
      : Promise.resolve([]),
    sectionIds.length > 0
      ? base44.asServiceRole.entities.SectionVote.filter({ sectionId: { $in: sectionIds } })
      : Promise.resolve([]),
  ]);

  const comments = [...docComments, ...sectionComments, ...suggestionComments];

  const emailToUserId = new Map();
  profiles.forEach(p => { if (p.email && p.userId) emailToUserId.set(p.email, p.userId); });

  const uniqueParticipants = new Set();
  const addByKey = (userId, email) => {
    if (userId) uniqueParticipants.add(userId);
    else if (email) { const uid = emailToUserId.get(email); uniqueParticipants.add(uid || email); }
  };

  votes.forEach(v => { addByKey(v.userId, v.created_by); });
  comments.forEach(c => { addByKey(c.created_by_id, c.created_by); });
  agreements.forEach(a => { addByKey(a.userId, a.userEmail); });
  suggestions.forEach(s => { addByKey(s.created_by_id, s.created_by); });
  sectionVotes.forEach(v => { addByKey(v.userId, v.created_by); });

  // Collapse: if a user's userId is already counted, remove their email key too
  // (prevents double-count when email-only records didn't resolve to userId)
  profiles.forEach(p => {
    if (p.userId && p.email && uniqueParticipants.has(p.userId)) {
      uniqueParticipants.delete(p.email);
    }
  });

  return Math.max(1, uniqueParticipants.size);
}

export async function calculateActiveVoterCount(base44, documentId) {
  try {
    const docSuggs = await base44.asServiceRole.entities.Suggestion.filter({ documentId });
    const docSuggIds = docSuggs.map(s => s.id);
    const docSecs = await base44.asServiceRole.entities.Section.filter({ documentId });
    const docSecIds = docSecs.map(s => s.id);
    const [suggVotes, secVotes] = await Promise.all([
      docSuggIds.length > 0
        ? base44.asServiceRole.entities.Vote.filter({ suggestionId: { $in: docSuggIds } })
        : Promise.resolve([]),
      docSecIds.length > 0
        ? base44.asServiceRole.entities.SectionVote.filter({ sectionId: { $in: docSecIds } })
        : Promise.resolve([]),
    ]);
    const voterIds = new Set();
    suggVotes.forEach(v => { if (v.userId) voterIds.add(v.userId); });
    secVotes.forEach(v => { if (v.userId) voterIds.add(v.userId); });
    return voterIds.size;
  } catch (e) {
    console.error('[consensusLogic] active voter count failed:', e);
    return 0;
  }
}

export function computeConsensusUpdate({ document, delta, totalUsers, activeVoterCount }) {
  const sectionConsensus = (delta + totalUsers) / (2 * totalUsers);
  const boundedConsensus = Math.min(1, Math.max(0, sectionConsensus));

  const updatedConsensuses = [...(document.consensuses || []), boundedConsensus];
  const consensusMeterAverage = updatedConsensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / updatedConsensuses.length;

  const rawThreshold = Math.max(2, Math.round(consensusMeterAverage * totalUsers));
  const cap = activeVoterCount > 0 ? Math.max(2, activeVoterCount) : rawThreshold;
  const newThreshold = Math.min(rawThreshold, cap);

  return { boundedConsensus, updatedConsensuses, consensusMeterAverage, rawThreshold, newThreshold };
}