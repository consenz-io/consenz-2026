/**
 * חישוב IDs של תורמים למסמך (לשימוש async במקומות שצריכים ספירה)
 * לתצוגה - השתמש ב-ContributorsModal שמחשב את זה בצד הקליינט
 */
import { base44 } from "@/api/base44Client";

export async function calculateDocumentContributors(documentId) {
  try {
    const [document, suggestions, sections, allPublicProfiles, allVotes, allArguments, allComments] = await Promise.all([
      base44.entities.Document.filter({ id: documentId }).then(d => d[0]),
      base44.entities.Suggestion.filter({ documentId }),
      base44.entities.Section.filter({ documentId }),
      base44.entities.UserPublicProfile.list(),
      base44.entities.Vote.list(),
      base44.entities.Argument.list(),
      base44.entities.Comment.list()
    ]);

    const uniqueUserIds = new Set();
    
    // יוצר המסמך
    if (document?.created_by) {
      const profile = allPublicProfiles?.find(p => p.email === document.created_by);
      if (profile?.userId) uniqueUserIds.add(profile.userId);
    }
    
    // יוצרי הצעות
    suggestions?.forEach(s => {
      if (s.created_by) {
        const profile = allPublicProfiles?.find(p => p.email === s.created_by);
        if (profile?.userId) uniqueUserIds.add(profile.userId);
      }
    });
    
    // מצביעים
    const suggestionIds = new Set(suggestions?.map(s => s.id) || []);
    allVotes?.forEach(v => {
      if (suggestionIds.has(v.suggestionId) && v.userId) {
        uniqueUserIds.add(v.userId);
      }
    });
    
    // כותבי טיעונים
    allArguments?.forEach(arg => {
      if (suggestionIds.has(arg.suggestionId) && arg.created_by) {
        const profile = allPublicProfiles?.find(p => p.email === arg.created_by);
        if (profile?.userId) uniqueUserIds.add(profile.userId);
      }
    });
    
    // מגיבים
    const sectionIds = new Set(sections?.map(s => s.id) || []);
    allComments?.forEach(c => {
      if ((c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) ||
          (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) ||
          (c.rootEntityType === 'document' && c.rootEntityId === documentId)) {
        if (c.created_by) {
          const profile = allPublicProfiles?.find(p => p.email === c.created_by);
          if (profile?.userId) uniqueUserIds.add(profile.userId);
        }
      }
    });
    
    return Math.max(1, uniqueUserIds.size);
  } catch (error) {
    console.error('[calculateDocumentContributors] Error:', error);
    return 1;
  }
}

// Export for backwards compatibility
export { calculateDocumentContributors as calculateContributorsFromData };