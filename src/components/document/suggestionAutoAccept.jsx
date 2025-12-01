import { base44 } from "@/api/base44Client";
import { notifySuggestionStatusChange } from "../notifications/createNotification";

const detectLanguage = (text) => {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

/**
 * בדיקה אם הצעה עברה את סף הקונסנזוס ויכולה להתקבל אוטומטית
 * מיושם לפי אפיון Consensus Meter Logic
 */
export async function checkSuggestionConsensus(suggestion, document) {
  const proVotes = suggestion.proVotes || 0;
  const conVotes = suggestion.conVotes || 0;
  const totalUsers = document.totalUsersInteracted || 1; // מונע חלוקה באפס
  
  // חישוב threshold דינמי על בסיס consensuses של המסמך
  let threshold;
  const consensuses = document.consensuses || [];
  
  if (consensuses.length > 0) {
    // document_consensus_meter = ממוצע כל ה-section_consensus_meter
    // מגבילים כל ערך ל-1 מקסימום (כי consensuses אמורים להיות בין 0 ל-1)
    const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
    // document_threshold = document_consensus_meter * totalUsers
    threshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));
  } else {
    // אם אין consensuses, משתמשים ב-threshold של המסמך
    threshold = document.threshold || 2;
  }
  
  // חישוב הדלתא הנוכחית
  const currentDelta = proVotes - conVotes;
  
  // בדיקה אם עברנו את הסף
  const shouldAccept = currentDelta >= threshold;
  
  console.log('[CONSENSUS CHECK]', {
    suggestionId: suggestion.id,
    proVotes: proVotes,
    conVotes: conVotes,
    currentDelta: currentDelta,
    totalUsers: totalUsers,
    consensuses: consensuses,
    threshold: threshold,
    shouldAccept
  });
  
  return { shouldAccept, consensus: currentDelta, threshold };
}

/**
 * מקבל הצעה אוטומטית - מיישם את השינוי במסמך
 */
export async function autoAcceptSuggestion(suggestion, userId, document) {
  // Validate inputs
  if (!suggestion || !suggestion.id) {
    console.error('[AUTO-ACCEPT] Invalid suggestion:', suggestion);
    return false;
  }
  
  if (!document || !document.id) {
    console.error('[AUTO-ACCEPT] Invalid document:', document);
    return false;
  }
  
  // בדיקה נוספת שההצעה אכן ממתינה - קוראים אותה מחדש מה-DB
  let freshSuggestion;
  try {
    const freshSuggestions = await base44.entities.Suggestion.filter({ id: suggestion.id });
    freshSuggestion = freshSuggestions[0];
  } catch (err) {
    console.error('[AUTO-ACCEPT] Error fetching suggestion:', err);
    return false;
  }
  
  if (!freshSuggestion) {
    console.log('[AUTO-ACCEPT] Suggestion not found:', suggestion.id);
    return false;
  }
  
  if (freshSuggestion.status !== 'pending') {
    console.log('[AUTO-ACCEPT] Suggestion already processed:', suggestion.id, freshSuggestion.status);
    return false;
  }
  
  const { shouldAccept, consensus } = await checkSuggestionConsensus(freshSuggestion, document);
  
  if (!shouldAccept) {
    console.log('[AUTO-ACCEPT] Suggestion does not meet threshold:', suggestion.id);
    return false;
  }
  
  // חישוב section_consensus_meter לפי האפיון - מוגבל לערך בין 0 ל-1
  // consensus = delta (proVotes - conVotes), ו-sectionConsensus צריך להיות יחס בין 0 ל-1
  const totalUsers = document.totalUsersInteracted || 1;
  // חישוב נכון: delta / totalUsers, כאשר delta יכול להיות עד totalUsers (כולם הצביעו בעד)
  const sectionConsensus = Math.min(1, Math.max(0, consensus / Math.max(1, totalUsers)));
  
  // עדכון המסמך: הוספת sectionConsensus למערך consensuses ועדכון threshold
  const currentConsensuses = document.consensuses || [];
  const updatedConsensuses = [...currentConsensuses, sectionConsensus];
  
  // חישוב document_consensus_meter חדש - מגבילים כל ערך ל-1 מקסימום
  const consensusMeterAverage = updatedConsensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / updatedConsensuses.length;
  
  // חישוב document_threshold חדש
  const newThreshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));
  
  console.log('[CONSENSUS METER UPDATE]', {
    sectionConsensus,
    updatedConsensuses,
    consensusMeterAverage,
    newThreshold,
    totalUsers
  });
  
  // עדכון המסמך עם הערכים החדשים
  await base44.entities.Document.update(document.id, {
    consensuses: updatedConsensuses,
    threshold: newThreshold
  });
  
  // עדכון threshold לכל ההצעות הממתינות - במקביל
  console.log('[THRESHOLD UPDATE] Updating threshold for all pending suggestions to:', newThreshold);
  const pendingSuggestions = await base44.entities.Suggestion.filter({
    documentId: document.id,
    status: 'pending'
  });
  
  // עדכון במקביל במקום לולאה רציפה
  await Promise.all(
    pendingSuggestions
      .filter(pendingSugg => pendingSugg.id !== suggestion.id)
      .map(pendingSugg => 
        base44.entities.Suggestion.update(pendingSugg.id, { threshold: newThreshold })
      )
  );
  
  // עדכון סטטוס ההצעה מיד כדי למנוע אישור כפול
  console.log('[AUTO-ACCEPT] Updating suggestion status to accepted immediately');
  await base44.entities.Suggestion.update(suggestion.id, { 
    status: 'accepted',
    suggestionConsensus: consensus 
  });

  try {
    // טיפול בהצעת עריכה לסעיף קיים
    if (freshSuggestion.type === 'edit_section' && freshSuggestion.sectionId) {
      let section;
      try {
        const sections = await base44.entities.Section.filter({ id: freshSuggestion.sectionId });
        section = sections[0];
      } catch (err) {
        console.error('[AUTO-ACCEPT] Error fetching section:', err);
        return false;
      }
      
      if (!section) {
        console.error('[AUTO-ACCEPT] Section not found:', freshSuggestion.sectionId);
        return false;
      }

      // שמירת גרסה עם התוכן הישן ועדכון הסעיף במקביל
      let versions = [];
      try {
        versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
      } catch (err) {
        console.error('[AUTO-ACCEPT] Error fetching versions:', err);
      }
      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;
      const newContentLanguage = detectLanguage(freshSuggestion.newContent || '');
      
      // הפעלת כל הפעולות במקביל
      await Promise.all([
        // שמירת גרסה עם התוכן הישן
        base44.entities.DocumentVersion.create({
          documentId: freshSuggestion.documentId,
          sectionId: section.id,
          content: section.content,
          changeDescription: `לפני: ${freshSuggestion.title || 'הצעת עריכה'}`,
          version: nextVersion,
          changeType: 'suggestion_accepted',
          suggestionId: freshSuggestion.id
        }),
        // עדכון הסעיף עם התוכן החדש
        base44.entities.Section.update(section.id, {
          content: freshSuggestion.newContent,
          lastEditedBy: userId,
          originalLanguage: newContentLanguage,
        }),
        // שמירת גרסה עם התוכן החדש
        base44.entities.DocumentVersion.create({
          documentId: freshSuggestion.documentId,
          sectionId: section.id,
          content: freshSuggestion.newContent,
          changeDescription: freshSuggestion.title || 'הצעת עריכה',
          version: nextVersion + 1,
          changeType: 'suggestion_accepted',
          suggestionId: freshSuggestion.id
        })
      ]);
    } 
    // טיפול בהצעה לסעיף חדש
    else if (freshSuggestion.type === 'new_section' && freshSuggestion.topicId) {
      let allSections = [];
      try {
        allSections = await base44.entities.Section.filter({ 
          documentId: freshSuggestion.documentId,
          topicId: freshSuggestion.topicId 
        }, 'order');
      } catch (err) {
        console.error('[AUTO-ACCEPT] Error fetching sections:', err);
      }
      
      let newOrder;
      if (freshSuggestion.insertPosition !== undefined && freshSuggestion.insertPosition !== null) {
        // הזחת סעיפים קיימים
        const sectionsToUpdate = allSections.filter(s => (s.order || 0) >= freshSuggestion.insertPosition);
        for (const sec of sectionsToUpdate) {
          try {
            await base44.entities.Section.update(sec.id, { order: (sec.order || 0) + 1 });
          } catch (err) {
            console.error('[AUTO-ACCEPT] Error updating section order:', err);
          }
        }
        newOrder = freshSuggestion.insertPosition;
      } else {
        // הוספה בסוף
        const maxOrder = allSections.length > 0 ? Math.max(...allSections.map(s => s.order || 0)) : -1;
        newOrder = maxOrder + 1;
      }
      
      // יצירת הסעיף החדש
      const newContentLanguage = detectLanguage(freshSuggestion.newContent || '');
      const newSection = await base44.entities.Section.create({
        documentId: freshSuggestion.documentId,
        topicId: freshSuggestion.topicId,
        content: freshSuggestion.newContent,
        order: newOrder,
        lastEditedBy: userId,
        originalLanguage: newContentLanguage,
      });
      
      // שמירת גרסה ראשונה
      await base44.entities.DocumentVersion.create({
        documentId: freshSuggestion.documentId,
        sectionId: newSection.id,
        content: freshSuggestion.newContent,
        changeDescription: freshSuggestion.title || 'סעיף חדש',
        version: 1,
        changeType: 'section_created',
        suggestionId: freshSuggestion.id
      });
    }
    
    // שליחת התראה ונקודות ברקע - לא חוסמים את ה-return
    const backgroundTasks = async () => {
      try {
        await notifySuggestionStatusChange({ suggestion: freshSuggestion, newStatus: 'accepted' });
      } catch (notifError) {
        console.error('[AUTO ACCEPT NOTIFICATION ERROR]', notifError);
      }
      
      // Award 200 points to suggestion creator when accepted (only if gamification enabled)
      const gamificationEnabled = document?.gamificationEnabled || false;
      if (gamificationEnabled && freshSuggestion.created_by) {
        try {
          const suggestionCreatorList = await base44.entities.User.filter({ email: freshSuggestion.created_by });
          if (suggestionCreatorList.length > 0) {
            const creatorId = suggestionCreatorList[0].id;
            const freshUser = await base44.entities.User.filter({ id: creatorId }).then(u => u[0]);
            if (freshUser) {
              const newPoints = (freshUser.points || 1000) + 200;
              await Promise.all([
                base44.entities.User.update(freshUser.id, { points: newPoints }),
                base44.entities.PointsTransaction.create({
                  userId: creatorId,
                  amount: 200,
                  action: 'suggestion_accepted',
                  description: `ההצעה שלך התקבלה: ${freshSuggestion.title || 'הצעה'}`,
                  relatedEntityId: freshSuggestion.id,
                  relatedEntityType: 'suggestion'
                })
              ]);
            }
          }
        } catch (pointsError) {
          console.error('[POINTS DEBUG] Error awarding points:', pointsError);
        }
      }
    };
    
    // הפעלה ברקע - לא מחכים
    backgroundTasks();
    
    return true;
  } catch (error) {
    console.error('Error auto-accepting suggestion:', error);
    return false;
  }
}

/**
 * בדיקה אם הצעת עריכת כותרת נושא עברה את סף הקונסנזוס
 */
export function checkTopicEditConsensus(suggestion, document) {
  const proVotes = suggestion.proVotes || 0;
  const conVotes = suggestion.conVotes || 0;
  const totalUsers = document.totalUsersInteracted || 1;
  
  // חישוב threshold דינמי על בסיס consensuses של המסמך - זהה לחישוב של הצעות סעיפים
  let threshold;
  const consensuses = document.consensuses || [];
  
  if (consensuses.length > 0) {
    // מגבילים כל ערך ל-1 מקסימום (כי consensuses אמורים להיות בין 0 ל-1)
    const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
    threshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));
  } else {
    threshold = document.threshold || 2;
  }
  
  const currentDelta = proVotes - conVotes;
  const shouldAccept = currentDelta >= threshold;
  
  console.log('[TOPIC CONSENSUS CHECK]', {
    suggestionId: suggestion.id,
    proVotes,
    conVotes,
    currentDelta,
    totalUsers,
    consensuses,
    threshold,
    shouldAccept
  });
  
  return { shouldAccept, consensus: currentDelta, threshold };
}

/**
 * אישור אוטומטי של הצעת עריכת כותרת נושא
 */
export async function autoAcceptTopicEditSuggestion(suggestion, userId, document) {
  const freshSuggestions = await base44.entities.TopicEditSuggestion.filter({ id: suggestion.id });
  const freshSuggestion = freshSuggestions[0];

  if (!freshSuggestion || freshSuggestion.status !== 'pending') {
    console.log('[AUTO-ACCEPT TOPIC] Suggestion not found or already processed:', suggestion.id, freshSuggestion?.status);
    return false;
  }

  // שימוש בחישוב דינמי של הסף - זהה לחישוב של הצעות סעיפים
  const { shouldAccept, consensus } = checkTopicEditConsensus(freshSuggestion, document);

  if (!shouldAccept) {
    console.log('[AUTO-ACCEPT TOPIC] Topic suggestion does not meet threshold:', suggestion.id);
    return false;
  }

  console.log('[AUTO-ACCEPT TOPIC] Auto-accepting topic edit suggestion:', suggestion.id);

  // חישוב section_consensus_meter והוספה למערך consensuses של המסמך - מוגבל לערך בין 0 ל-1
  const totalUsers = document.totalUsersInteracted || 1;
  const sectionConsensus = Math.min(1, Math.max(0, consensus / totalUsers));
  
  const currentConsensuses = document.consensuses || [];
  const updatedConsensuses = [...currentConsensuses, sectionConsensus];
  
  // חישוב ממוצע עם הגבלה לכל ערך
  const consensusMeterAverage = updatedConsensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / updatedConsensuses.length;
  const newThreshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));
  
  console.log('[TOPIC CONSENSUS METER UPDATE]', {
    sectionConsensus,
    updatedConsensuses,
    consensusMeterAverage,
    newThreshold,
    totalUsers
  });

  // עדכון המסמך עם הערכים החדשים
  await base44.entities.Document.update(document.id, {
    consensuses: updatedConsensuses,
    threshold: newThreshold
  });

  // Accept suggestion - update topic title
  await base44.entities.Topic.update(freshSuggestion.topicId, {
    title: freshSuggestion.newTitle
  });
  
  await base44.entities.TopicEditSuggestion.update(freshSuggestion.id, {
    status: 'accepted'
  });

  // Create document version for topic title change
  const versions = await base44.entities.DocumentVersion.filter({ documentId: document.id });
  const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
  
  await base44.entities.DocumentVersion.create({
    documentId: document.id,
    changeDescription: `כותרת נושא עודכנה: ${freshSuggestion.originalTitle} ← ${freshSuggestion.newTitle}`,
    version: nextVersion,
    changeType: 'suggestion_accepted',
  });

  // Award points to creator
  if (document.gamificationEnabled) {
    const suggestionCreatorList = await base44.entities.User.filter({ email: freshSuggestion.created_by });
    if (suggestionCreatorList.length > 0) {
      const suggestionCreator = suggestionCreatorList[0];
      const freshUser = await base44.entities.User.filter({ id: suggestionCreator.id }).then(u => u[0]);
      if (freshUser) {
        const newPoints = (freshUser.points || 1000) + 100;
        await base44.entities.User.update(freshUser.id, { points: newPoints });
        
        await base44.entities.PointsTransaction.create({
          userId: suggestionCreator.id,
          amount: 100,
          action: 'suggestion_accepted',
          description: `הצעתך לעריכת כותרת נושא התקבלה: ${freshSuggestion.newTitle}`,
          relatedEntityType: 'topic'
        });
      }
    }
  }

  return true;
}