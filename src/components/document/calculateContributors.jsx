import { base44 } from "@/api/base44Client";

/**
 * Calculate unique contributors count for document (async version)
 * Includes: document creator, suggestion creators, voters, argument writers, and commenters
 */
export async function calculateDocumentContributors(documentId) {
  try {
    // Fetch all data in parallel
    const [documents, suggestions, sections, allVotes, publicProfiles, allArguments, allComments, followers] = await Promise.all([
      base44.entities.Document.filter({ id: documentId }),
      base44.entities.Suggestion.filter({ documentId }),
      base44.entities.Section.filter({ documentId }),
      base44.entities.Vote.list(),
      base44.entities.UserPublicProfile.list(),
      base44.entities.Argument.list(),
      base44.entities.Comment.list(),
      base44.entities.DocumentFollow.filter({ documentId })
    ]);

    const uniqueEmails = new Set();
    
    // 1. Document creator
    if (documents.length > 0 && documents[0].created_by) {
      uniqueEmails.add(documents[0].created_by);
    }
    
    // 2. Suggestion creators
    suggestions.forEach(s => {
      if (s.created_by) uniqueEmails.add(s.created_by);
    });
    
    // 3. Voters - both by userId and created_by
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
    
    // 4. Argument writers
    allArguments.forEach(arg => {
      if (suggestionIds.has(arg.suggestionId) && arg.created_by) {
        uniqueEmails.add(arg.created_by);
      }
    });
    
    // 5. Commenters on suggestions
    allComments.forEach(c => {
      if (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId) && c.created_by) {
        uniqueEmails.add(c.created_by);
      }
    });
    
    // 6. Commenters on sections
    const sectionIds = new Set(sections.map(s => s.id));
    allComments.forEach(c => {
      if (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId) && c.created_by) {
        uniqueEmails.add(c.created_by);
      }
    });
    
    // 7. Commenters on document
    allComments.forEach(c => {
      if (c.rootEntityType === 'document' && c.rootEntityId === documentId && c.created_by) {
        uniqueEmails.add(c.created_by);
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
 */
export function calculateContributorsFromData({
  document,
  suggestions = [],
  allVotes = [],
  allUsers = [],
  allArguments = [],
  allComments = [],
  sections = []
}) {
  const uniqueEmails = new Set();
  
  // 1. Document creator
  if (document?.created_by) uniqueEmails.add(document.created_by);
  
  // 2. Suggestion creators
  suggestions.forEach(s => {
    if (s.created_by) uniqueEmails.add(s.created_by);
  });
  
  // 3. Voters - both by userId and created_by
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
  
  // 4. Argument writers
  allArguments.forEach(arg => {
    if (suggestionIds.has(arg.suggestionId) && arg.created_by) {
      uniqueEmails.add(arg.created_by);
    }
  });
  
  // 5. Commenters on suggestions
  allComments.forEach(c => {
    if (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId) && c.created_by) {
      uniqueEmails.add(c.created_by);
    }
  });
  
  // 6. Commenters on sections
  const sectionIds = new Set(sections.map(s => s.id));
  allComments.forEach(c => {
    if (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId) && c.created_by) {
      uniqueEmails.add(c.created_by);
    }
  });
  
  // 7. Commenters on document
  if (document?.id) {
    allComments.forEach(c => {
      if (c.rootEntityType === 'document' && c.rootEntityId === document.id && c.created_by) {
        uniqueEmails.add(c.created_by);
      }
    });
  }
  
  return Math.max(1, uniqueEmails.size);
}