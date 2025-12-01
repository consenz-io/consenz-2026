import { base44 } from "@/api/base44Client";

/**
 * מחשב את מספר התורמים הייחודיים למסמך
 * כולל: יוצר המסמך, יוצרי הצעות, מצביעים, כותבי טיעונים וכותבי תגובות
 */
export async function calculateDocumentContributors(documentId) {
  const uniqueEmails = new Set();
  
  try {
    // 1. הוסף את יוצר המסמך
    const documents = await base44.entities.Document.filter({ id: documentId });
    if (documents.length > 0) {
      const document = documents[0];
      if (document.created_by) {
        uniqueEmails.add(document.created_by);
      }
    }
    
    // 2. הוסף את כל יוצרי ההצעות
    const suggestions = await base44.entities.Suggestion.filter({ documentId });
    suggestions.forEach(s => {
      if (s.created_by) {
        uniqueEmails.add(s.created_by);
      }
    });
    
    // 3. הוסף את כל המצביעים
    const suggestionIds = suggestions.map(s => s.id);
    if (suggestionIds.length > 0) {
      // קבל את כל ההצבעות לכל ההצעות של המסמך
      const allVotes = [];
      for (const suggestionId of suggestionIds) {
        const votes = await base44.entities.Vote.filter({ suggestionId });
        allVotes.push(...votes);
      }
      
      // המר את ה-userId ל-email
      const userIds = [...new Set(allVotes.map(v => v.userId))];
      if (userIds.length > 0) {
        const users = await base44.entities.User.list();
        const userMap = {};
        users.forEach(u => {
          userMap[u.id] = u.email;
        });
        
        userIds.forEach(userId => {
          if (userMap[userId]) {
            uniqueEmails.add(userMap[userId]);
          }
        });
      }
    }
    
    // 4. הוסף את כל כותבי הטיעונים
    if (suggestionIds.length > 0) {
      const allArguments = [];
      for (const suggestionId of suggestionIds) {
        const args = await base44.entities.Argument.filter({ suggestionId });
        allArguments.push(...args);
      }
      
      allArguments.forEach(arg => {
        if (arg.created_by) {
          uniqueEmails.add(arg.created_by);
        }
      });
    }
    
    // 5. הוסף את כל כותבי התגובות להצעות
    if (suggestionIds.length > 0) {
      const allSuggestionComments = [];
      for (const suggestionId of suggestionIds) {
        const comments = await base44.entities.Comment.filter({ 
          rootEntityType: 'suggestion',
          rootEntityId: suggestionId 
        });
        allSuggestionComments.push(...comments);
      }
      
      allSuggestionComments.forEach(c => {
        if (c.created_by) {
          uniqueEmails.add(c.created_by);
        }
      });
    }
    
    // 6. הוסף את כל כותבי התגובות לסעיפים
    const sections = await base44.entities.Section.filter({ documentId });
    const sectionIds = sections.map(s => s.id);
    if (sectionIds.length > 0) {
      const allSectionComments = [];
      for (const sectionId of sectionIds) {
        const comments = await base44.entities.Comment.filter({ 
          rootEntityType: 'section',
          rootEntityId: sectionId 
        });
        allSectionComments.push(...comments);
      }
      
      allSectionComments.forEach(c => {
        if (c.created_by) {
          uniqueEmails.add(c.created_by);
        }
      });
    }
    
    // 7. הוסף את כל כותבי התגובות בדיון הכללי של המסמך
    const documentComments = await base44.entities.Comment.filter({ 
      rootEntityType: 'document',
      rootEntityId: documentId 
    });
    documentComments.forEach(c => {
      if (c.created_by) {
        uniqueEmails.add(c.created_by);
      }
    });
    
    return uniqueEmails.size;
  } catch (error) {
    console.error('[CALCULATE CONTRIBUTORS ERROR]', error);
    return 0;
  }
}