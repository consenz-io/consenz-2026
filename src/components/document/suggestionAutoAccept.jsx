import { base44 } from "@/api/base44Client";
import { notifySuggestionStatusChange } from "../notifications/createNotification";
import { calculateContributorsFromData } from "./calculateContributors";

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
  console.log('='.repeat(80));
  console.log('[CONSENSUS CHECK] ===== START CHECKING SUGGESTION =====');
  console.log('[CONSENSUS CHECK] Suggestion ID:', suggestion.id);
  console.log('[CONSENSUS CHECK] Suggestion Title:', suggestion.title);
  console.log('[CONSENSUS CHECK] Suggestion Type:', suggestion.type);
  console.log('[CONSENSUS CHECK] Suggestion Status:', suggestion.status);
  
  const proVotes = suggestion.proVotes || 0;
  const conVotes = suggestion.conVotes || 0;
  
  // חישוב דינמי של מספר המשתתפים
  const [suggestions, allVotes, publicProfiles, allArguments, allComments, sections] = await Promise.all([
    base44.entities.Suggestion.filter({ documentId: document.id }),
    base44.entities.Vote.list(),
    base44.entities.UserPublicProfile.list(),
    base44.entities.Argument.list(),
    base44.entities.Comment.list(),
    base44.entities.Section.filter({ documentId: document.id })
  ]);
  
  const totalUsers = calculateContributorsFromData({
    document,
    suggestions,
    allVotes,
    allUsers: publicProfiles,
    allArguments,
    allComments,
    sections
  }) || 1;
  
  console.log('[CONSENSUS CHECK] Vote counts:');
  console.log('[CONSENSUS CHECK] - Pro votes:', proVotes);
  console.log('[CONSENSUS CHECK] - Con votes:', conVotes);
  console.log('[CONSENSUS CHECK] - Total users interacted:', totalUsers);
  
  // חישוב threshold דינמי על בסיס consensuses של המסמך
  let threshold;
  const consensuses = document.consensuses || [];
  
  console.log('[CONSENSUS CHECK] Document consensus data:');
  console.log('[CONSENSUS CHECK] - Consensuses array:', consensuses);
  console.log('[CONSENSUS CHECK] - Consensuses length:', consensuses.length);
  console.log('[CONSENSUS CHECK] - Document default threshold:', document.threshold);
  
  if (consensuses.length > 0) {
    // document_consensus_meter = ממוצע כל ה-section_consensus_meter
    // מגבילים כל ערך ל-1 מקסימום (כי consensuses אמורים להיות בין 0 ל-1)
    const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
    // document_threshold = document_consensus_meter * totalUsers
    // מינימום threshold הוא 1 כשיש consensuses
    threshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));
    
    console.log('[CONSENSUS CHECK] Threshold calculation (dynamic):');
    console.log('[CONSENSUS CHECK] - Consensus meter average:', consensusMeterAverage);
    console.log('[CONSENSUS CHECK] - Formula: Math.max(2, Math.round(' + consensusMeterAverage + ' * ' + totalUsers + '))');
    console.log('[CONSENSUS CHECK] - Calculated threshold:', threshold);
  } else {
    // אם אין consensuses, משתמשים ב-threshold של המסמך (מינימום 2)
    threshold = Math.max(2, document.threshold || 2);
    console.log('[CONSENSUS CHECK] Threshold calculation (default):');
    console.log('[CONSENSUS CHECK] - Using document.threshold:', document.threshold);
    console.log('[CONSENSUS CHECK] - Calculated threshold:', threshold);
  }
  
  // חישוב הדלתא הנוכחית
  const currentDelta = proVotes - conVotes;
  
  // בדיקה אם עברנו את הסף - דלתא חייבת להיות **גדולה או שווה ל** הסף
  // כך אם threshold=2, נדרש delta של לפחות 2 (למשל: 2 בעד, 0 נגד)
  const shouldAccept = currentDelta >= threshold;
  
  console.log('[CONSENSUS CHECK] Final calculation:');
  console.log('[CONSENSUS CHECK] - Current delta (pro - con):', currentDelta);
  console.log('[CONSENSUS CHECK] - Required threshold:', threshold);
  console.log('[CONSENSUS CHECK] - Comparison:', currentDelta, '>=', threshold, '=', shouldAccept);
  console.log('[CONSENSUS CHECK] - Explanation: Delta must be GREATER THAN OR EQUAL to threshold');
  console.log('[CONSENSUS CHECK] - DECISION: Should accept?', shouldAccept ? '✅ YES' : '❌ NO');
  console.log('[CONSENSUS CHECK] ===== END CHECKING SUGGESTION =====');
  console.log('='.repeat(80));
  
  return { shouldAccept, consensus: currentDelta, threshold };
}

/**
 * מקבל הצעה אוטומטית - מיישם את השינוי במסמך
 */
export async function autoAcceptSuggestion(suggestion, userId, document) {
  console.log('🔵'.repeat(40));
  console.log('[AUTO-ACCEPT] ========== AUTO ACCEPT FLOW START ==========');
  console.log('[AUTO-ACCEPT] Called with suggestion ID:', suggestion.id);
  console.log('[AUTO-ACCEPT] Suggestion title:', suggestion.title);
  console.log('[AUTO-ACCEPT] User ID:', userId);
  console.log('[AUTO-ACCEPT] Document ID:', document.id);
  
  // Validate inputs
  if (!suggestion || !suggestion.id) {
    console.error('[AUTO-ACCEPT] ❌ FAILED: Invalid suggestion:', suggestion);
    return false;
  }
  
  if (!document || !document.id) {
    console.error('[AUTO-ACCEPT] ❌ FAILED: Invalid document:', document);
    return false;
  }
  
  // שלב 1: קריאת המצב העדכני ביותר מהשרת - source of truth
  console.log('[AUTO-ACCEPT] Step 1: Fetching fresh suggestion data from server...');
  let freshSuggestion;
  try {
    const freshSuggestions = await base44.entities.Suggestion.filter({ id: suggestion.id });
    freshSuggestion = freshSuggestions[0];
    console.log('[AUTO-ACCEPT] Fresh suggestion data:', {
      id: freshSuggestion?.id,
      status: freshSuggestion?.status,
      proVotes: freshSuggestion?.proVotes,
      conVotes: freshSuggestion?.conVotes,
      type: freshSuggestion?.type,
      sectionId: freshSuggestion?.sectionId
    });
  } catch (err) {
    console.error('[AUTO-ACCEPT] ❌ FAILED: Error fetching suggestion:', err);
    return false;
  }
  
  if (!freshSuggestion) {
    console.log('[AUTO-ACCEPT] ❌ FAILED: Suggestion not found:', suggestion.id);
    return false;
  }
  
  // Verify suggestion is still pending - בדיקה מול המצב האמיתי מהשרת
  console.log('[AUTO-ACCEPT] Step 2: Verifying suggestion status...');
  if (freshSuggestion.status !== 'pending') {
    console.log('[AUTO-ACCEPT] ⚠️ SKIP: Suggestion already processed (status:', freshSuggestion.status, ')');
    return false;
  }
  console.log('[AUTO-ACCEPT] ✅ Status is pending, continuing...');
  
  // וידוא שעדיין עומדים בתנאי הקונצנזוס לפי הנתונים העדכניים
  console.log('[AUTO-ACCEPT] Step 3: Checking consensus threshold...');
  const { shouldAccept, consensus } = await checkSuggestionConsensus(freshSuggestion, document);
  
  if (!shouldAccept) {
    console.log('[AUTO-ACCEPT] ⚠️ SKIP: Suggestion does not meet threshold');
    console.log('[AUTO-ACCEPT] - Consensus (delta):', consensus);
    console.log('[AUTO-ACCEPT] - This suggestion will NOT be auto-accepted');
    return false;
  }
  
  console.log('[AUTO-ACCEPT] ✅ Threshold met! Proceeding with auto-acceptance...');
  console.log('[AUTO-ACCEPT] - Consensus (delta):', consensus);
  
  // עדכון מד הקונצנזוס רק עבור עריכות סעיפים קיימים (לא סעיפים חדשים)
  // סעיפים חדשים, עריכות ישירות ושינויי כותרות לא נספרים במד הקונצנזוס
  const shouldUpdateConsensusMeter = freshSuggestion.type === 'edit_section';
  
  // שמירת מספר המשתתפים בזמן הקבלה של ההצעה הזו
  const participantsAtAcceptance = document.totalUsersInteracted || 1;
  
  let updatedConsensuses = document.consensuses || [];
  let newThreshold = document.threshold || 2;
  
  if (shouldUpdateConsensusMeter) {
    // חישוב section_consensus_meter לפי האפיון:
    // proVotes / (proVotes + conVotes) - יחס התמיכה מכלל המצביעים
    // מוגבל לערך בין 0 ל-1
    const totalVotes = (freshSuggestion.proVotes || 0) + (freshSuggestion.conVotes || 0);
    const sectionConsensus = totalVotes > 0 
      ? Math.min(1, Math.max(0, (freshSuggestion.proVotes || 0) / totalVotes))
      : 1; // אם אין הצבעות כלל, נניח קונסנזוס מלא
    
    // עדכון המסמך: הוספת sectionConsensus למערך consensuses ועדכון threshold
    updatedConsensuses = [...updatedConsensuses, sectionConsensus];
    
    // חישוב document_consensus_meter חדש - מגבילים כל ערך ל-1 מקסימום
    const consensusMeterAverage = updatedConsensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / updatedConsensuses.length;
    
    // חישוב document_threshold חדש - עם מספר המשתתפים הנוכחי (מינימום 1)
    newThreshold = Math.max(1, Math.round(consensusMeterAverage * participantsAtAcceptance));
    
    console.log('[CONSENSUS METER UPDATE]', {
      sectionConsensus,
      updatedConsensuses,
      consensusMeterAverage,
      newThreshold,
      participantsAtAcceptance
    });
    
    // עדכון המסמך עם הערכים החדשים
    await base44.entities.Document.update(document.id, {
      consensuses: updatedConsensuses,
      threshold: newThreshold
    });
  } else {
    console.log('[CONSENSUS METER SKIP] Not updating consensus meter for new_section type');
  }
  
  // עדכון threshold לכל ההצעות הממתינות - במקביל
  console.log('[THRESHOLD UPDATE] Starting threshold update');
  console.log('[THRESHOLD UPDATE] New threshold:', newThreshold);
  console.log('[THRESHOLD UPDATE] Document ID:', document.id);
  console.log('[THRESHOLD UPDATE] Accepted suggestion type:', freshSuggestion.type);
  console.log('[THRESHOLD UPDATE] Accepted suggestion sectionId:', freshSuggestion.sectionId);
  
  const pendingSuggestions = await base44.entities.Suggestion.filter({
    documentId: document.id,
    status: 'pending'
  });
  
  console.log('[THRESHOLD UPDATE] Found pending suggestions:', pendingSuggestions.length);
  console.log('[THRESHOLD UPDATE] Pending suggestions:', pendingSuggestions.map(s => ({
    id: s.id,
    type: s.type,
    sectionId: s.sectionId,
    title: s.title,
    proVotes: s.proVotes,
    conVotes: s.conVotes,
    originalContentPreview: s.originalContent?.substring(0, 50)
  })));
  
  // עדכון במקביל - threshold וגם originalContent להצעות לאותו סעיף
  if (freshSuggestion.type === 'edit_section' && freshSuggestion.sectionId) {
    console.log('[THRESHOLD UPDATE] This is an edit_section suggestion, checking for other suggestions to same section');
    
    // מצא הצעות אחרות לאותו סעיף
    const otherSuggestionsToSameSection = pendingSuggestions.filter(
      pendingSugg => 
        pendingSugg.id !== suggestion.id && 
        pendingSugg.type === 'edit_section' && 
        pendingSugg.sectionId === freshSuggestion.sectionId
    );
    
    console.log('[THRESHOLD UPDATE] Found other suggestions to same section:', otherSuggestionsToSameSection.length);
    otherSuggestionsToSameSection.forEach(s => {
      console.log('[THRESHOLD UPDATE] - Suggestion BEFORE reset:', {
        id: s.id,
        title: s.title,
        proVotes: s.proVotes,
        conVotes: s.conVotes,
        delta: (s.proVotes || 0) - (s.conVotes || 0),
        currentThreshold: s.threshold,
        newThreshold: newThreshold,
        oldOriginalContentPreview: s.originalContent?.substring(0, 80),
        newOriginalContentPreview: freshSuggestion.newContent?.substring(0, 80)
      });
    });
    
    // עדכן הצעות
    await Promise.all(
      pendingSuggestions
        .filter(pendingSugg => pendingSugg.id !== suggestion.id)
        .map(pendingSugg => {
          // אם זו הצעה לאותו סעיף, עדכן originalContent ו-threshold (אבל לא מאפסים הצבעות)
          if (pendingSugg.type === 'edit_section' && pendingSugg.sectionId === freshSuggestion.sectionId) {
            console.log('[THRESHOLD UPDATE] 🔄 Updating suggestion', pendingSugg.id, 'because section content changed');
            console.log('[THRESHOLD UPDATE] - Keeping existing votes:', pendingSugg.proVotes, 'pro /', pendingSugg.conVotes, 'con');
            return base44.entities.Suggestion.update(pendingSugg.id, { 
              threshold: newThreshold,
              originalContent: freshSuggestion.newContent // התוכן החדש של הסעיף
            });
          }
          // אחרת, רק עדכן את ה-threshold
          console.log('[THRESHOLD UPDATE] Updating suggestion', pendingSugg.id, 'with new threshold only');
          return base44.entities.Suggestion.update(pendingSugg.id, { threshold: newThreshold });
        })
    );
    
    console.log('[THRESHOLD UPDATE] Finished updating all suggestions');
    
    // אחרי העדכון, בדוק מה המצב של ההצעות האחרות
    const updatedSuggestions = await base44.entities.Suggestion.filter({
      documentId: document.id,
      status: 'pending'
    });
    
    console.log('[THRESHOLD UPDATE] After update - pending suggestions status:');
    updatedSuggestions
      .filter(s => s.type === 'edit_section' && s.sectionId === freshSuggestion.sectionId)
      .forEach(s => {
        const delta = (s.proVotes || 0) - (s.conVotes || 0);
        console.log('[THRESHOLD UPDATE] - Suggestion AFTER reset:', {
          id: s.id,
          title: s.title,
          proVotes: s.proVotes,
          conVotes: s.conVotes,
          delta: delta,
          threshold: s.threshold,
          wouldAutoAcceptWithOneVote: delta >= (s.threshold || newThreshold),
          originalContentPreview: s.originalContent?.substring(0, 80)
        });
      });
  } else {
    console.log('[THRESHOLD UPDATE] Not an edit_section or no sectionId, updating threshold only for all');
    // אם זו לא הצעת עריכה, רק עדכן threshold
    await Promise.all(
      pendingSuggestions
        .filter(pendingSugg => pendingSugg.id !== suggestion.id)
        .map(pendingSugg => 
          base44.entities.Suggestion.update(pendingSugg.id, { threshold: newThreshold })
        )
    );
    console.log('[THRESHOLD UPDATE] Finished updating all suggestions');
  }
  
  try {
    console.log('[AUTO-ACCEPT] Starting section creation/update...');
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

      // שמירת גרסה עם התוכן הישן ועדכון הסעיף
      let versions = [];
      try {
        versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
      } catch (err) {
        console.error('[AUTO-ACCEPT] Error fetching versions:', err);
      }
      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;
      const newContentLanguage = detectLanguage(freshSuggestion.newContent || '');

      console.log('[AUTO-ACCEPT EDIT] Creating versions for section edit:', {
        sectionId: section.id,
        nextVersion: nextVersion,
        oldContent: section.content?.substring(0, 50),
        newContent: freshSuggestion.newContent?.substring(0, 50)
      });

      // שמירת גרסה "לפני" עם התוכן הישן
      await base44.entities.DocumentVersion.create({
        documentId: freshSuggestion.documentId,
        sectionId: section.id,
        content: section.content,
        changeDescription: `לפני: ${freshSuggestion.title || 'הצעת עריכה'}`,
        version: nextVersion,
        changeType: 'suggestion_accepted',
        suggestionId: freshSuggestion.id
      });

      // עדכון הסעיף עם התוכן החדש
      await base44.entities.Section.update(section.id, {
        content: freshSuggestion.newContent,
        lastEditedBy: userId,
        originalLanguage: newContentLanguage,
      });

      // שמירת גרסה "אחרי" עם התוכן החדש
      await base44.entities.DocumentVersion.create({
        documentId: freshSuggestion.documentId,
        sectionId: section.id,
        content: freshSuggestion.newContent,
        changeDescription: freshSuggestion.title || 'הצעת עריכה',
        version: nextVersion + 1,
        changeType: 'suggestion_accepted',
        suggestionId: freshSuggestion.id
      });
    } 
    // טיפול בהצעה למחיקת סעיף
     else if (freshSuggestion.type === 'delete_section' && freshSuggestion.sectionId) {
       console.log('[AUTO-ACCEPT DELETE] Deleting section:', freshSuggestion.sectionId);

       // שמירת גרסאות לפני ואחרי המחיקה
       const section = await base44.entities.Section.filter({ id: freshSuggestion.sectionId }).then(s => s[0]);
       if (section) {
         const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
         const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;

         console.log('[AUTO-ACCEPT DELETE] Creating versions for section deletion:', {
           sectionId: section.id,
           nextVersion: nextVersion,
           currentContent: section.content?.substring(0, 50)
         });

         // גרסה "לפני" - התוכן הקיים
         await base44.entities.DocumentVersion.create({
           documentId: freshSuggestion.documentId,
           sectionId: section.id,
           content: section.content,
           changeDescription: `לפני: ${freshSuggestion.title || 'מחיקת סעיף'}`,
           version: nextVersion,
           changeType: 'suggestion_accepted',
           suggestionId: freshSuggestion.id
         });

         console.log('[AUTO-ACCEPT DELETE] Created "before" version:', nextVersion);

         // גרסה "אחרי" - סעיף נמחק (שומר את התוכן המקורי עם סימון למחיקה)
         await base44.entities.DocumentVersion.create({
           documentId: freshSuggestion.documentId,
           sectionId: section.id,
           content: section.content, // שומר את התוכן המקורי, לא ריק
           changeDescription: freshSuggestion.title || 'סעיף נמחק',
           version: nextVersion + 1,
           changeType: 'suggestion_accepted',
           suggestionId: freshSuggestion.id
         });

         console.log('[AUTO-ACCEPT DELETE] Created "after" version:', nextVersion + 1);

         // מחיקת הסעיף
         await base44.entities.Section.delete(section.id);

         console.log('[AUTO-ACCEPT DELETE] Section deleted successfully');
       } else {
         console.error('[AUTO-ACCEPT DELETE] Section not found:', freshSuggestion.sectionId);
       }
     }
    // טיפול בהצעה לסעיף חדש
     else if (freshSuggestion.type === 'new_section') {
       console.log('[AUTO-ACCEPT NEW_SECTION] Creating new section with suggestion:', freshSuggestion.id);

       let targetTopicId = freshSuggestion.topicId;

       // אם יש newTopicTitle - צור נושא חדש
       if (!targetTopicId && freshSuggestion.newTopicTitle) {
         console.log('[AUTO-ACCEPT] Creating new topic:', freshSuggestion.newTopicTitle);

         // מצא את ה-order הגבוה ביותר של נושאים קיימים
         const existingTopics = await base44.entities.Topic.filter({ 
           documentId: freshSuggestion.documentId 
         }, 'order');

         // השתמש ב-newTopicOrder אם קיים, אחרת הוסף בסוף
         let topicOrderToUse;
         if (freshSuggestion.newTopicOrder !== undefined && freshSuggestion.newTopicOrder !== null) {
           console.log('[AUTO-ACCEPT] Using specified newTopicOrder:', freshSuggestion.newTopicOrder);
           topicOrderToUse = freshSuggestion.newTopicOrder;

           // הזז נושאים קיימים עם order גדול או שווה
           const topicsToShift = existingTopics.filter(t => (t.order || 0) >= topicOrderToUse);
           if (topicsToShift.length > 0) {
             console.log('[AUTO-ACCEPT] Shifting', topicsToShift.length, 'topics to make room');
             await Promise.all(
               topicsToShift.map(topic => 
                 base44.entities.Topic.update(topic.id, { order: (topic.order || 0) + 1 })
               )
             );
           }
         } else {
           const maxTopicOrder = existingTopics.length > 0 
             ? Math.max(...existingTopics.map(t => t.order || 0)) 
             : -1;
           topicOrderToUse = maxTopicOrder + 1;
           console.log('[AUTO-ACCEPT] No newTopicOrder specified, adding at end with order:', topicOrderToUse);
         }

         // יצירת הנושא החדש
         const newTopicLanguage = detectLanguage(freshSuggestion.newTopicTitle);
         const newTopic = await base44.entities.Topic.create({
           documentId: freshSuggestion.documentId,
           title: freshSuggestion.newTopicTitle,
           order: topicOrderToUse,
           originalLanguage: newTopicLanguage
         });

         targetTopicId = newTopic.id;
         console.log('[AUTO-ACCEPT] Created new topic with ID:', targetTopicId, 'at order:', topicOrderToUse);
       }

       if (!targetTopicId) {
         console.error('[AUTO-ACCEPT] No topicId and no newTopicTitle for new_section suggestion');
         return false;
       }

       let allSections = [];
       try {
         allSections = await base44.entities.Section.filter({ 
           documentId: freshSuggestion.documentId,
           topicId: targetTopicId 
         }, 'order');
       } catch (err) {
         console.error('[AUTO-ACCEPT] Error fetching sections:', err);
       }

       let newOrder;
       if (freshSuggestion.insertPosition !== undefined && freshSuggestion.insertPosition !== null) {
         // הזחת סעיפים קיימים - מלמעלה למטה כדי למנוע התנגשויות
         const sectionsToUpdate = allSections
           .filter(s => (s.order || 0) >= freshSuggestion.insertPosition)
           .sort((a, b) => (b.order || 0) - (a.order || 0)); // מלמעלה למטה

         // עדכון במקביל - כל סעיף מקבל order חדש שלא מתנגש
         await Promise.all(
           sectionsToUpdate.map(sec => 
             base44.entities.Section.update(sec.id, { order: (sec.order || 0) + 1 })
           )
         );

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
         topicId: targetTopicId,
         content: freshSuggestion.newContent,
         order: newOrder,
         lastEditedBy: userId,
         originalLanguage: newContentLanguage,
       });

       console.log('[AUTO-ACCEPT NEW_SECTION] Created new section with ID:', newSection.id);

       // שמירת גרסה ראשונה (רק גרסה אחת לסעיף חדש - ללא "לפני")
       await base44.entities.DocumentVersion.create({
         documentId: freshSuggestion.documentId,
         sectionId: newSection.id,
         content: freshSuggestion.newContent,
         changeDescription: freshSuggestion.title || 'סעיף חדש',
         version: 1,
         changeType: 'section_created',
         suggestionId: freshSuggestion.id
       });

       console.log('[AUTO-ACCEPT NEW_SECTION] Created version 1 for new section');
     }
    
    // עדכון סטטוס ההצעה רק אחרי שהסעיף נוצר בהצלחה
    console.log('[AUTO-ACCEPT] Section created successfully, updating suggestion status to accepted');
    await base44.entities.Suggestion.update(suggestion.id, { 
      status: 'accepted',
      suggestionConsensus: consensus,
      participantsAtAcceptance: participantsAtAcceptance
    });
    
    // שליחת התראה ונקודות - בדיקה שיש created_by
    if (freshSuggestion.created_by) {
      try {
        console.log('[AUTO ACCEPT] Sending notification for suggestion:', freshSuggestion.id, 'created_by:', freshSuggestion.created_by);
        await notifySuggestionStatusChange({ suggestion: freshSuggestion, newStatus: 'accepted' });
        console.log('[AUTO ACCEPT] Notification sent successfully');
      } catch (notifError) {
        console.error('[AUTO ACCEPT NOTIFICATION ERROR]', notifError);
        console.error('[AUTO ACCEPT NOTIFICATION ERROR] Stack:', notifError.stack);
      }
    } else {
      console.warn('[AUTO ACCEPT] No created_by for suggestion:', freshSuggestion.id, '- skipping notification');
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
    
    return true;
  } catch (error) {
    console.error('[AUTO-ACCEPT] ❌ CRITICAL ERROR during section creation:', error);
    console.error('[AUTO-ACCEPT] Error details:', error.message);
    console.error('[AUTO-ACCEPT] Stack trace:', error.stack);
    console.error('[AUTO-ACCEPT] Suggestion ID:', suggestion.id);
    console.error('[AUTO-ACCEPT] Suggestion type:', freshSuggestion?.type);
    return false;
  }
}

/**
 * בדיקה אם הצעת עריכת כותרת נושא עברה את סף הקונסנזוס
 */
export async function checkTopicEditConsensus(suggestion, document) {
  const proVotes = suggestion.proVotes || 0;
  const conVotes = suggestion.conVotes || 0;
  
  // חישוב דינמי של מספר המשתתפים
  const [suggestions, allVotes, publicProfiles, allArguments, allComments, sections] = await Promise.all([
    base44.entities.Suggestion.filter({ documentId: document.id }),
    base44.entities.Vote.list(),
    base44.entities.UserPublicProfile.list(),
    base44.entities.Argument.list(),
    base44.entities.Comment.list(),
    base44.entities.Section.filter({ documentId: document.id })
  ]);
  
  const totalUsers = calculateContributorsFromData({
    document,
    suggestions,
    allVotes,
    allUsers: publicProfiles,
    allArguments,
    allComments,
    sections
  }) || 1;
  
  // חישוב threshold דינמי על בסיס consensuses של המסמך - זהה לחישוב של הצעות סעיפים
  let threshold;
  const consensuses = document.consensuses || [];
  
  if (consensuses.length > 0) {
    // מגבילים כל ערך ל-1 מקסימום (כי consensuses אמורים להיות בין 0 ל-1)
    const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
    threshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));
  } else {
    threshold = Math.max(2, document.threshold || 2);
  }
  
  const currentDelta = proVotes - conVotes;
  // בדיקה אם עברנו את הסף - דלתא חייבת להיות **גדולה או שווה ל** הסף
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
  // שלב 1: קריאת המצב העדכני ביותר מהשרת - source of truth
  const freshSuggestions = await base44.entities.TopicEditSuggestion.filter({ id: suggestion.id });
  const freshSuggestion = freshSuggestions[0];

  if (!freshSuggestion) {
    console.log('[AUTO-ACCEPT TOPIC] Suggestion not found:', suggestion.id);
    return false;
  }

  // Verify suggestion is still pending - בדיקה מול המצב האמיתי מהשרת
  if (freshSuggestion.status !== 'pending') {
    console.log('[AUTO-ACCEPT TOPIC] Suggestion already processed (status:', freshSuggestion.status, '), skipping');
    return false;
  }

  // וידוא שעדיין עומדים בתנאי הקונצנזוס לפי הנתונים העדכניים
  const { shouldAccept, consensus } = checkTopicEditConsensus(freshSuggestion, document);

  if (!shouldAccept) {
    console.log('[AUTO-ACCEPT TOPIC] Suggestion no longer meets threshold, skipping');
    return false;
  }

  console.log('[AUTO-ACCEPT TOPIC] Auto-accepting topic edit suggestion:', suggestion.id);

  // שינויי כותרות נושאים לא נספרים במד הקונצנזוס - רק עריכות תוכן סעיפים
  console.log('[TOPIC CONSENSUS METER SKIP] Not updating consensus meter for topic title changes');

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