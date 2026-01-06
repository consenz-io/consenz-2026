import { base44 } from "@/api/base44Client";

/**
 * Calculate unique contributors (participants) count for document (async version)
 * CRITERIA: Only users who performed one of the following actions:
 * 1. Voted on a suggestion
 * 2. Commented on a suggestion, section, or document
 * 3. Signed the document agreement
 */
export async function calculateDocumentContributors(documentId) {
  try {
    // Fetch all data in parallel
    const [suggestions, sections, allVotes, publicProfiles, allComments, followers, documentAgreements] = await Promise.all([
      base44.entities.Suggestion.filter({ documentId }),
      base44.entities.Section.filter({ documentId }),
      base44.entities.Vote.list(),
      base44.entities.UserPublicProfile.list(),
      base44.entities.Comment.list(),
      base44.entities.DocumentFollow.filter({ documentId }),
      base44.entities.DocumentAgreement.filter({ documentId })
    ]);

    const uniqueEmails = new Set();
    
    // 1. Voters on suggestions in this document
    const suggestionIds = new Set(suggestions.map(s => s.id));
    const userIdToEmail = {};
    publicProfiles.forEach(p => { userIdToEmail[p.userId] = p.email; });
    
    allVotes.forEach(v => {
      if (suggestionIds.has(v.suggestionId)) {
        if (userIdToEmail[v.userId]) {
          uniqueEmails.add(userIdToEmail[v.userId]);
        }
        if (v.created_by) {
          uniqueEmails.add(v.created_by);
        }
      }
    });
    
    // 2. Commenters on suggestions
    allComments.forEach(c => {
      if (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId) && c.created_by) {
        uniqueEmails.add(c.created_by);
      }
    });
    
    // 3. Commenters on sections
    const sectionIds = new Set(sections.map(s => s.id));
    allComments.forEach(c => {
      if (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId) && c.created_by) {
        uniqueEmails.add(c.created_by);
      }
    });
    
    // 4. Commenters on document
    allComments.forEach(c => {
      if (c.rootEntityType === 'document' && c.rootEntityId === documentId && c.created_by) {
        uniqueEmails.add(c.created_by);
      }
    });
    
    // 5. Users who signed the document
    documentAgreements.forEach(a => {
      if (a.userEmail) {
        uniqueEmails.add(a.userEmail);
      }
    });
    
    // Auto-follow all participants
    const followerUserIds = new Set(followers.map(f => f.userId));
    const profilesToAutoFollow = publicProfiles.filter(p => 
      uniqueEmails.has(p.email) && !followerUserIds.has(p.userId)
    );
    
    if (profilesToAutoFollow.length > 0) {
      console.log('[AUTO-FOLLOW] Auto-following', profilesToAutoFollow.length, 'participants');
      await Promise.all(
        profilesToAutoFollow.map(profile =>
          base44.entities.DocumentFollow.create({
            documentId,
            userId: profile.userId,
            followedAt: new Date().toISOString()
          }).catch(err => {
            console.error('[AUTO-FOLLOW] Error auto-following user:', profile.email, err);
          })
        )
      );
    }
    
    return Math.max(1, uniqueEmails.size);
  } catch (error) {
    console.error('[CALCULATE CONTRIBUTORS ERROR]', error);
    return 1;
  }
}

/**
 * Synchronous calculation of participants from already loaded data
 * Used for real-time display in counters
 * CRITERIA: Only users who performed one of the following actions:
 * 1. Voted on a suggestion
 * 2. Commented on a suggestion, section, or document
 * 3. Signed the document agreement
 */
export function calculateContributorsFromData({
  document,
  suggestions = [],
  allVotes = [],
  allUsers = [],
  allComments = [],
  sections = [],
  documentAgreements = []
}) {
  const uniqueEmails = new Set();
  
  // 1. Voters on suggestions
  const suggestionIds = new Set(suggestions.map(s => s.id));
  const userIdToEmail = {};
  allUsers.forEach(u => { userIdToEmail[u.id] = u.email; });
  
  allVotes.forEach(v => {
    if (suggestionIds.has(v.suggestionId)) {
      if (userIdToEmail[v.userId]) {
        uniqueEmails.add(userIdToEmail[v.userId]);
      }
      if (v.created_by) {
        uniqueEmails.add(v.created_by);
      }
    }
  });
  
  // 2. Commenters on suggestions
  allComments.forEach(c => {
    if (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId) && c.created_by) {
      uniqueEmails.add(c.created_by);
    }
  });
  
  // 3. Commenters on sections
  const sectionIds = new Set(sections.map(s => s.id));
  allComments.forEach(c => {
    if (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId) && c.created_by) {
      uniqueEmails.add(c.created_by);
    }
  });
  
  // 4. Commenters on document
  if (document?.id) {
    allComments.forEach(c => {
      if (c.rootEntityType === 'document' && c.rootEntityId === document.id && c.created_by) {
        uniqueEmails.add(c.created_by);
      }
    });
  }
  
  // 5. Users who signed the document
  if (documentAgreements && documentAgreements.length > 0) {
    documentAgreements.forEach(a => {
      if (a.userEmail) {
        uniqueEmails.add(a.userEmail);
      }
    });
  }
  
  return Math.max(1, uniqueEmails.size);
}