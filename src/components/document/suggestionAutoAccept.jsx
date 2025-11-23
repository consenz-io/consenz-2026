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
    const consensusMeterAverage = consensuses.reduce((sum, val) => sum + val, 0) / consensuses.length;
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
  // בדיקה נוספת שההצעה אכן ממתינה - קוראים אותה מחדש מה-DB
  const freshSuggestions = await base44.entities.Suggestion.filter({ id: suggestion.id });
  const freshSuggestion = freshSuggestions[0];
  
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
  
  // חישוב section_consensus_meter לפי האפיון
  const totalUsers = document.totalUsersInteracted || 1;
  const sectionConsensus = consensus / totalUsers;
  
  // עדכון המסמך: הוספת sectionConsensus למערך consensuses ועדכון threshold
  const currentConsensuses = document.consensuses || [];
  const updatedConsensuses = [...currentConsensuses, sectionConsensus];
  
  // חישוב document_consensus_meter חדש
  const consensusMeterAverage = updatedConsensuses.reduce((sum, val) => sum + val, 0) / updatedConsensuses.length;
  
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
  
  // עדכון threshold לכל ההצעות הממתינות
  console.log('[THRESHOLD UPDATE] Updating threshold for all pending suggestions to:', newThreshold);
  const pendingSuggestions = await base44.entities.Suggestion.filter({
    documentId: document.id,
    status: 'pending'
  });
  
  for (const pendingSugg of pendingSuggestions) {
    if (pendingSugg.id !== suggestion.id) { // דלג על ההצעה הנוכחית - נעדכן אותה אחרי
      await base44.entities.Suggestion.update(pendingSugg.id, {
        threshold: newThreshold
      });
    }
  }
  
  // עדכון סטטוס ההצעה מיד כדי למנוע אישור כפול
  console.log('[AUTO-ACCEPT] Updating suggestion status to accepted immediately');
  await base44.entities.Suggestion.update(suggestion.id, { 
    status: 'accepted',
    suggestionConsensus: consensus 
  });

  try {
    // טיפול בהצעת עריכה לסעיף קיים
    if (freshSuggestion.type === 'edit_section' && freshSuggestion.sectionId) {
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
      const newContentLanguage = detectLanguage(suggestion.newContent);
      await base44.entities.Section.update(section.id, {
        content: suggestion.newContent,
        lastEditedBy: userId,
        originalLanguage: newContentLanguage,
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
    else if (freshSuggestion.type === 'new_section' && freshSuggestion.topicId) {
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
      const newContentLanguage = detectLanguage(suggestion.newContent);
      const newSection = await base44.entities.Section.create({
        documentId: suggestion.documentId,
        topicId: suggestion.topicId,
        content: suggestion.newContent,
        order: newOrder,
        lastEditedBy: userId,
        originalLanguage: newContentLanguage,
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
    
    // שליחת התראה למחבר ההצעה
    console.log('[AUTO ACCEPT] Sending notification to suggestion creator');
    try {
      await notifySuggestionStatusChange({ suggestion, newStatus: 'accepted' });
    } catch (notifError) {
      console.error('[AUTO ACCEPT NOTIFICATION ERROR]', notifError);
    }
    
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

  const proVotes = freshSuggestion.proVotes || 0;
  const conVotes = freshSuggestion.conVotes || 0;
  const delta = proVotes - conVotes;

  if (delta < document.threshold) {
    console.log('[AUTO-ACCEPT TOPIC] Topic suggestion does not meet threshold:', suggestion.id);
    return false;
  }

  console.log('[AUTO-ACCEPT TOPIC] Auto-accepting topic edit suggestion:', suggestion.id);

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