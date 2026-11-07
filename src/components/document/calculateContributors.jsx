import { base44 } from "@/api/base44Client";

/**
 * Calculate unique contributors (participants) count for document (async version)
 * Uses userId as the primary dedup key (always present on Vote/SectionVote records).
 * Falls back to email for records that only have created_by (comments, suggestion creators).
 */
/**
 * The single source of truth for "who participates in this document".
 * Returns both the count and the roster, from document-scoped queries only.
 */
export async function getDocumentParticipants(documentId, options = {}) {
  const { includeSectionVotes = true, includeAgreements = true, language = 'en' } = options;
  try {
    // Stage 1: fetch document-specific suggestions, sections, and agreements
    const [suggestions, sections, documentAgreements] = await Promise.all([
      base44.entities.Suggestion.filter({ documentId }),
      base44.entities.Section.filter({ documentId }),
      includeAgreements
        ? base44.entities.DocumentAgreement.filter({ documentId })
        : Promise.resolve([]),
    ]);

    const suggestionIdArr = suggestions.map(s => s.id);
    const sectionIdArr = sections.map(s => s.id);

    // Stage 2: fetch ONLY votes/comments/sectionVotes scoped to this document
    // (was: Vote.list() / Comment.list() / SectionVote.list() — loaded the ENTIRE platform)
    const commentQuery = [
      { rootEntityType: 'document', rootEntityId: documentId },
    ];
    if (sectionIdArr.length > 0) commentQuery.push({ rootEntityType: 'section', rootEntityId: { $in: sectionIdArr } });
    if (suggestionIdArr.length > 0) commentQuery.push({ rootEntityType: 'suggestion', rootEntityId: { $in: suggestionIdArr } });

    const [allVotes, allComments, allSectionVotes] = await Promise.all([
      suggestionIdArr.length > 0
        ? base44.entities.Vote.filter({ suggestionId: { $in: suggestionIdArr } })
        : Promise.resolve([]),
      base44.entities.Comment.filter({ $or: commentQuery }),
      includeSectionVotes && sectionIdArr.length > 0
        ? base44.entities.SectionVote.filter({ sectionId: { $in: sectionIdArr } })
        : Promise.resolve([]),
    ]);

    // Stage 3: fetch only the user profiles that appear in this document's data
    const userIds = new Set();
    const emails = new Set();
    suggestions.forEach(s => { if (s.created_by_id) userIds.add(s.created_by_id); if (s.created_by) emails.add(s.created_by); });
    sections.forEach(s => { if (s.lastEditedBy) userIds.add(s.lastEditedBy); });
    allVotes.forEach(v => { if (v.userId) userIds.add(v.userId); if (v.created_by) emails.add(v.created_by); });
    allComments.forEach(c => { if (c.created_by_id) userIds.add(c.created_by_id); if (c.created_by) emails.add(c.created_by); });
    allSectionVotes.forEach(v => { if (v.userId) userIds.add(v.userId); if (v.created_by) emails.add(v.created_by); });
    documentAgreements.forEach(a => { if (a.userId) userIds.add(a.userId); if (a.userEmail) emails.add(a.userEmail); });

    // UserPublicProfile.email is a private field (owner/admin only), so
    // profiles are resolved by userId only.
    const profileQuery = [];
    if (userIds.size > 0) profileQuery.push({ userId: { $in: Array.from(userIds) } });
    const publicProfiles = profileQuery.length > 0
      ? await base44.entities.UserPublicProfile.filter({ $or: profileQuery })
      : [];

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
      if (!c.created_by && !c.created_by_id) return;
      if (
        (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) ||
        (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) ||
        (c.rootEntityType === 'document' && c.rootEntityId === documentId)
      ) {
        if (c.created_by_id) uniqueParticipants.add(c.created_by_id);
        else addByEmail(c.created_by);
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

    // 7. Suggestion creators
    suggestions.forEach(s => {
      if (s.created_by_id) uniqueParticipants.add(s.created_by_id);
      else if (s.created_by) addByEmail(s.created_by);
    });

    // Collapse: drop the email key of anyone already counted by userId
    publicProfiles.forEach(p => {
      if (p.userId && p.email && uniqueParticipants.has(p.userId)) {
        uniqueParticipants.delete(p.email);
      }
    });

    const profileByUserId = new Map();
    const profileByEmail = new Map();
    publicProfiles.forEach(p => {
      if (p.userId) profileByUserId.set(p.userId, p);
      if (p.email) profileByEmail.set(p.email, p);
    });

    let placeholder = 0;
    const participants = Array.from(uniqueParticipants).map(key => {
      const profile = profileByUserId.get(key) || profileByEmail.get(key);
      if (profile) {
        return { id: profile.userId || key, email: profile.email || '', full_name: profile.fullName || 'User' };
      }
      if (typeof key === 'string' && key.includes('@')) {
        return { id: key, email: key, full_name: key.split('@')[0] };
      }
      placeholder += 1;
      return {
        id: key,
        email: '',
        full_name: language === 'he' ? `משתתף ${placeholder}` : language === 'ar' ? `مشارك ${placeholder}` : `Participant ${placeholder}`,
      };
    });

    return { count: Math.max(1, uniqueParticipants.size), participants };
  } catch (error) {
    console.error('[CALCULATE CONTRIBUTORS ERROR]', error);
    return { count: 1, participants: [] };
  }
}

export async function calculateDocumentContributors(documentId, options = {}) {
  const { count } = await getDocumentParticipants(documentId, options);
  return count;
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
    const uid = u.userId;
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
    if (!c.created_by && !c.created_by_id) return;
    if (
      (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) ||
      (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) ||
      (c.rootEntityType === 'document' && c.rootEntityId === document?.id)
    ) {
      if (c.created_by_id) uniqueParticipants.add(c.created_by_id);
      else addByEmail(c.created_by);
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

  // 7. Suggestion creators
  suggestions.forEach(s => {
    if (s.created_by_id) uniqueParticipants.add(s.created_by_id);
    else if (s.created_by) addByEmail(s.created_by);
  });

  // Collapse: if a user's userId is already counted, remove their email key too
  // (prevents double-count when email-only records didn't resolve to userId)
  allUsers.forEach(u => {
    if (u.userId && u.email && uniqueParticipants.has(u.userId)) {
      uniqueParticipants.delete(u.email);
    }
  });

  return Math.max(1, uniqueParticipants.size);
}

/**
 * One pass over already-loaded data → Map<documentId, contributorCount>.
 *
 * Calling calculateContributorsFromData per document card re-scans every vote,
 * comment and profile for each card (O(documents × records)). This builds the
 * matching maps once and does a single pass, so a list of N documents costs O(N).
 * Same participant rules as calculateContributorsFromData.
 */
export function calculateContributorsByDocument({
  documents = [],
  suggestions = [],
  votes = [],
  comments = [],
  sections = [],
  sectionVotes = [],
  profiles = [],
} = {}) {
  const emailToUserId = new Map();
  const emailByUserId = new Map();
  profiles.forEach(p => {
    if (!p.userId) return;
    if (p.email) {
      emailToUserId.set(p.email, p.userId);
      emailByUserId.set(p.userId, p.email);
    }
  });

  const docIdBySuggestion = new Map();
  suggestions.forEach(s => { if (s.id && s.documentId) docIdBySuggestion.set(s.id, s.documentId); });

  const docIdBySection = new Map();
  sections.forEach(s => { if (s.id && s.documentId) docIdBySection.set(s.id, s.documentId); });

  const keysByDoc = new Map();
  const addKey = (docId, key) => {
    if (!docId || !key) return;
    let set = keysByDoc.get(docId);
    if (!set) { set = new Set(); keysByDoc.set(docId, set); }
    set.add(key);
  };
  const resolveKey = (userId, email) =>
    userId || (email ? (emailToUserId.get(email) || email) : null);

  suggestions.forEach(s => addKey(s.documentId, resolveKey(s.created_by_id, s.created_by)));

  votes.forEach(v => addKey(docIdBySuggestion.get(v.suggestionId), resolveKey(v.userId, v.created_by)));

  comments.forEach(c => {
    const docId =
      c.rootEntityType === 'document' ? c.rootEntityId :
      c.rootEntityType === 'suggestion' ? docIdBySuggestion.get(c.rootEntityId) :
      c.rootEntityType === 'section' ? docIdBySection.get(c.rootEntityId) :
      null;
    addKey(docId, resolveKey(c.created_by_id, c.created_by));
  });

  sectionVotes.forEach(v => addKey(docIdBySection.get(v.sectionId), resolveKey(v.userId, v.created_by)));

  const result = new Map();
  documents.forEach(doc => {
    const set = keysByDoc.get(doc.id);
    if (!set) { result.set(doc.id, 1); return; }
    for (const key of Array.from(set)) {
      const email = emailByUserId.get(key);
      if (email && set.has(email)) set.delete(email);
    }
    result.set(doc.id, Math.max(1, set.size));
  });
  return result;
}