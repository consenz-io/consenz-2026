import { base44 } from "@/api/base44Client";

/**
 * מחשב את מספר התורמים הייחודיים למסמך (גרסה אסינכרונית)
 * כולל: יוצר המסמך, יוצרי הצעות, מצביעים, כותבי טיעונים וכותבי תגובות
 */
export async function calculateDocumentContributors(documentId) {
  try {
    // Fetch all data in parallel
    const [documents, suggestions, sections, allVotes, allUsers, allArguments, allComments] = await Promise.all([
      base44.entities.Document.filter({ id: documentId }),
      base44.entities.Suggestion.filter({ documentId }),
      base44.entities.Section.filter({ documentId }),
      base44.entities.Vote.list(),
      base44.entities.User.list(),
      base44.entities.Argument.list(),
      base44.entities.Comment.list()
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
    
    // 3. Voters
    const suggestionIds = new Set(suggestions.map(s => s.id));
    const userIdToEmail = {};
    allUsers.forEach(u => { userIdToEmail[u.id] = u.email; });
    
    allVotes.forEach(v => {
      if (suggestionIds.has(v.suggestionId) && userIdToEmail[v.userId]) {
        uniqueEmails.add(userIdToEmail[v.userId]);
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
    
    return Math.max(1, uniqueEmails.size);
  } catch (error) {
    console.error('[CALCULATE CONTRIBUTORS ERROR]', error);
    return 1;
  }
}

/**
 * חישוב סינכרוני של תורמים מנתונים שכבר נטענו
 * משמש לתצוגה בזמן אמת בקאונטרים
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
  
  // 3. Voters - גם לפי userId וגם לפי created_by
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