import { base44 } from "@/api/base44Client";

/**
 * בדיקה אם הצעה עברה את סף הקונסנזוס ויכולה להתקבל אוטומטית
 */
export async function checkSuggestionConsensus(suggestion, document) {
  const totalVotes = (suggestion.proVotes || 0) + (suggestion.conVotes || 0);
  
  // חייבות להיות לפחות הצבעה אחת
  if (totalVotes === 0) {
    return { shouldAccept: false, consensus: 0 };
  }
  
  const consensus = suggestion.proVotes / totalVotes;
  
  // חישוב threshold דינמי מההצעות שאושרו במסמך
  const acceptedSuggestions = await base44.entities.Suggestion.filter({ 
    documentId: document.id, 
    status: 'accepted' 
  });
  
  let threshold = 0.5;
  if (acceptedSuggestions.length > 0) {
    const avg = acceptedSuggestions.reduce((sum, s) => {
      const total = (s.proVotes || 0) + (s.conVotes || 0);
      return sum + (total > 0 ? (s.proVotes / total) : 0);
    }, 0) / acceptedSuggestions.length;
    threshold = avg;
  }
  
  // בדיקה אם עברנו את הסף
  const shouldAccept = consensus >= threshold;
  
  return { shouldAccept, consensus };
}

/**
 * מקבל הצעה אוטומטית - מיישם את השינוי במסמך
 */
export async function autoAcceptSuggestion(suggestion, userId, document) {
  const { shouldAccept, consensus } = checkSuggestionConsensus(
    suggestion, 
    { threshold: suggestion.document?.threshold || 0.5 }
  );
  
  if (!shouldAccept || suggestion.status !== 'pending') {
    return false;
  }

  try {
    // טיפול בהצעת עריכה לסעיף קיים
    if (suggestion.type === 'edit_section' && suggestion.sectionId) {
      const sections = await base44.entities.Section.filter({ id: suggestion.sectionId });
      const section = sections[0];
      
      if (!section) {
        console.error('Section not found:', suggestion.sectionId);
        return false;
      }

      // שמירת גרסה עם התוכן הישן
      const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
      
      await base44.entities.DocumentVersion.create({
        documentId: suggestion.documentId,
        sectionId: section.id,
        content: section.content,
        changeDescription: `לפני: ${suggestion.title}`,
        version: nextVersion,
        changeType: 'suggestion_accepted',
        suggestionId: suggestion.id
      });
      
      // עדכון הסעיף עם התוכן החדש
      await base44.entities.Section.update(section.id, {
        content: suggestion.newContent,
        lastEditedBy: userId
      });
      
      // שמירת גרסה עם התוכן החדש
      await base44.entities.DocumentVersion.create({
        documentId: suggestion.documentId,
        sectionId: section.id,
        content: suggestion.newContent,
        changeDescription: suggestion.title,
        version: nextVersion + 1,
        changeType: 'suggestion_accepted',
        suggestionId: suggestion.id
      });
    } 
    // טיפול בהצעה לסעיף חדש
    else if (suggestion.type === 'new_section' && suggestion.topicId) {
      const allSections = await base44.entities.Section.filter({ 
        documentId: suggestion.documentId,
        topicId: suggestion.topicId 
      }, 'order');
      
      let newOrder;
      if (suggestion.insertPosition !== undefined && suggestion.insertPosition !== null) {
        // הזחת סעיפים קיימים
        const sectionsToUpdate = allSections.filter(s => s.order >= suggestion.insertPosition);
        for (const sec of sectionsToUpdate) {
          await base44.entities.Section.update(sec.id, { order: sec.order + 1 });
        }
        newOrder = suggestion.insertPosition;
      } else {
        // הוספה בסוף
        const maxOrder = allSections.length > 0 ? Math.max(...allSections.map(s => s.order)) : -1;
        newOrder = maxOrder + 1;
      }
      
      // יצירת הסעיף החדש
      const newSection = await base44.entities.Section.create({
        documentId: suggestion.documentId,
        topicId: suggestion.topicId,
        content: suggestion.newContent,
        order: newOrder,
        lastEditedBy: userId
      });
      
      // שמירת גרסה ראשונה
      await base44.entities.DocumentVersion.create({
        documentId: suggestion.documentId,
        sectionId: newSection.id,
        content: suggestion.newContent,
        changeDescription: suggestion.title,
        version: 1,
        changeType: 'section_created',
        suggestionId: suggestion.id
      });
    }

    // עדכון סטטוס ההצעה
    await base44.entities.Suggestion.update(suggestion.id, { 
      status: 'accepted',
      suggestionConsensus: consensus 
    });
    
    // Award 200 points to suggestion creator when accepted (only if gamification enabled)
    const gamificationEnabled = document?.gamificationEnabled || false;
    console.log('[POINTS DEBUG] Suggestion accepted - gamification enabled:', gamificationEnabled);
    if (gamificationEnabled) {
      console.log('[POINTS DEBUG] Awarding +200 points to suggestion creator:', suggestion.created_by);
      const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
      console.log('[POINTS DEBUG] Found creators:', suggestionCreatorList.length);
      if (suggestionCreatorList.length > 0) {
        const creatorId = suggestionCreatorList[0].id;
        // Fetch fresh data to avoid race conditions
        const freshUser = await base44.entities.User.filter({ id: creatorId }).then(u => u[0]);
        console.log('[POINTS DEBUG] Fresh user points before:', freshUser?.points);
        if (freshUser) {
          const newPoints = (freshUser.points || 1000) + 200;
          await base44.entities.User.update(freshUser.id, {
            points: newPoints
          });
          console.log('[POINTS DEBUG] Updated user points to:', newPoints);
          
          // Create points transaction record
          await base44.entities.PointsTransaction.create({
            userId: creatorId,
            amount: 200,
            action: 'suggestion_accepted',
            description: `ההצעה שלך התקבלה: ${suggestion.title}`,
            relatedEntityId: suggestion.id,
            relatedEntityType: 'suggestion'
          });
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error auto-accepting suggestion:', error);
    return false;
  }
}