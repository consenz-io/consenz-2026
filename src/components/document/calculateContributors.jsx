import { base44 } from "@/api/base44Client";

/**
 * Calculate unique contributors (participants) count for document (async version)
 * Uses userId as the primary dedup key (always present on Vote/SectionVote records).
 * Falls back to email for records that only have created_by (comments, suggestion creators).
 */
export async function calculateDocumentContributors(documentId) {
  try {
    const [suggestions, sections, allVotes, publicProfiles, allComments, documentAgreements, allSectionVotes] = await Promise.all([
      base44.entities.Suggestion.filter({ documentId }),
      base44.entities.Section.filter({ documentId }),
      base44.entities.Vote.list(),
      base44.entities.UserPublicProfile.list(),
      base44.entities.Comment.list(),
      base44.entities.DocumentAgreement.filter({ documentId }),
      base44.entities.SectionVote.list()
    ]);

    // Build email → userId map (for resolving comment/suggestion creator emails)
    const emailToUserId = {};
    publicProfiles.forEach(p => { if (p.email && p.userId) emailToUserId[p.email] = p.userId; });

    const uniqueParticipants = new Set();
    const suggestionIds = new Set(suggestions.map(s => s.id));
    const sectionIds = new Set(sections.map(s => s.id));

    // Helper: add a participant by email — resolve to userId when possible
    const addByEmail = (email) => {
      if (!email) return;
      const uid = emailToUserId[email];
      uniqueParticipants.add(uid || email);
    };

    // 1. Voters on suggestions — userId is always present on Vote records
    allVotes.forEach(v => {
      if (suggestionIds.has(v.suggestionId)) {
        if (v.userId) uniqueParticipants.add(v.userId);
        else if (v.created_by) addByEmail(v.created_by);
      }
    });

    // 2-4. Commenters on suggestions, sections, and document
    allComments.forEach(c => {
      if (!c.created_by) return;
      if (
        (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) ||
        (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) ||
        (c.rootEntityType === 'document' && c.rootEntityId === documentId)
      ) {
        addByEmail(c.created_by);
      }
    });

    // 5. Users who signed the document
    documentAgreements.forEach(a => {
      if (a.userId) uniqueParticipants.add(a.userId);
      else if (a.userEmail) addByEmail(a.userEmail);
    });

    // 6. Voters on existing sections — userId is always present on SectionVote records
    allSectionVotes.forEach(v => {
      if (sectionIds.has(v.sectionId)) {
        if (v.userId) uniqueParticipants.add(v.userId);
        else if (v.created_by) addByEmail(v.created_by);
      }
    });

    return Math.max(1, uniqueParticipants.size);
  } catch (error) {
    console.error('[CALCULATE CONTRIBUTORS ERROR]', error);
    return 1;
  }
}

/**
 * Synchronous calculation of participants from already loaded data.
 * Used for real-time display in counters.
 * Uses userId as the primary dedup key.
 */
export function calculateContributorsFromData({
  document,
  suggestions = [],
  allVotes = [],
  allUsers = [],
  allComments = [],
  sections = [],
  documentAgreements = [],
  allSectionVotes = []
}) {
  // Build email → userId map from public profiles
  const emailToUserId = {};
  allUsers.forEach(u => {
    const uid = u.userId || u.id;
    if (uid && u.email) emailToUserId[u.email] = uid;
  });

  const uniqueParticipants = new Set();
  const suggestionIds = new Set(suggestions.map(s => s.id));
  const sectionIds = new Set(sections.map(s => s.id));

  const addByEmail = (email) => {
    if (!email) return;
    const uid = emailToUserId[email];
    uniqueParticipants.add(uid || email);
  };

  // 1. Voters on suggestions
  allVotes.forEach(v => {
    if (suggestionIds.has(v.suggestionId)) {
      if (v.userId) uniqueParticipants.add(v.userId);
      else if (v.created_by) addByEmail(v.created_by);
    }
  });

  // 2-4. Commenters on suggestions, sections, and document
  allComments.forEach(c => {
    if (!c.created_by) return;
    if (
      (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) ||
      (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) ||
      (c.rootEntityType === 'document' && c.rootEntityId === document?.id)
    ) {
      addByEmail(c.created_by);
    }
  });

  // 5. Agreement signers
  if (documentAgreements && documentAgreements.length > 0) {
    documentAgreements.forEach(a => {
      if (a.userId) uniqueParticipants.add(a.userId);
      else if (a.userEmail) addByEmail(a.userEmail);
    });
  }

  // 6. Voters on existing sections
  if (allSectionVotes.length > 0 && sectionIds.size > 0) {
    allSectionVotes.forEach(v => {
      if (sectionIds.has(v.sectionId)) {
        if (v.userId) uniqueParticipants.add(v.userId);
        else if (v.created_by) addByEmail(v.created_by);
      }
    });
  }

  return Math.max(1, uniqueParticipants.size);
}