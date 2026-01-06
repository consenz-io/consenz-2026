import { base44 } from "@/api/base44Client";

/**
 * Calculate unique contributors count for document (async version)
 * Contributors: voters, commenters, and signers
 */
export async function calculateDocumentContributors(documentId) {
  try {
    // Fetch all data in parallel
    const [suggestions, sections, allVotes, publicProfiles, allComments, followers, agreements] = await Promise.all([
      base44.entities.Suggestion.filter({ documentId }),
      base44.entities.Section.filter({ documentId }),
      base44.entities.Vote.list(),
      base44.entities.UserPublicProfile.list(),
      base44.entities.Comment.list(),
      base44.entities.DocumentFollow.filter({ documentId }),
      base44.entities.DocumentAgreement.filter({ documentId })
    ]);

    const uniqueEmails = new Set();
    
    // 1. Voters - both by userId and created_by
    const suggestionIds = new Set(suggestions.map(s => s.id));
    const userIdToEmail = {};
    publicProfiles.forEach(p => { userIdToEmail[p.userId] = p.email; });
    
    allVotes.forEach(v => {
      if (suggestionIds.has(v.suggestionId)) {
        // לפי userId
        if (userIdToEmail[v.userId]) {
          uniqueEmails.add(userIdToEmail[v.userId]);
        }
        // גם לפי created_by של ההצבעה ישירות
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
    
    // 5. Signers
    agreements.forEach(a => {
      if (a.userEmail) {
        uniqueEmails.add(a.userEmail);
      }
    });
    
    // Auto-follow all contributors
    const followerUserIds = new Set(followers.map(f => f.userId));
    const profilesToAutoFollow = publicProfiles.filter(p => 
      uniqueEmails.has(p.email) && !followerUserIds.has(p.userId)
    );
    
    if (profilesToAutoFollow.length > 0) {
      console.log('[AUTO-FOLLOW] Auto-following', profilesToAutoFollow.length, 'contributors');
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
 * Synchronous calculation of contributors from already loaded data
 * Used for real-time display in counters
 * Contributors: voters, commenters, and signers
 */
export function calculateContributorsFromData({
  document,
  suggestions = [],
  allVotes = [],
  allUsers = [],
  allComments = [],
  sections = [],
  agreements = []
}) {
  const uniqueEmails = new Set();
  
  // 1. Voters - both by userId and created_by
  const suggestionIds = new Set(suggestions.map(s => s.id));
  const userIdToEmail = {};
  allUsers.forEach(u => { userIdToEmail[u.id] = u.email; });
  
  allVotes.forEach(v => {
    if (suggestionIds.has(v.suggestionId)) {
      // לפי userId
      if (userIdToEmail[v.userId]) {
        uniqueEmails.add(userIdToEmail[v.userId]);
      }
      // גם לפי created_by של ההצבעה ישירות
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
  
  // 5. Signers
  if (agreements) {
    agreements.forEach(a => {
      if (a.userEmail) {
        uniqueEmails.add(a.userEmail);
      }
    });
  }
  
  return Math.max(1, uniqueEmails.size);
}