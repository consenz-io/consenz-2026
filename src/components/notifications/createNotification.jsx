import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

// Translation helper - gets user's preferred language
async function getUserLanguage(userId) {
  try {
    const users = await base44.entities.User.filter({ id: userId });
    if (users.length > 0 && users[0].preferredLanguage) {
      return users[0].preferredLanguage;
    }
  } catch (error) {
    console.error('Error getting user language:', error);
  }
  return 'he'; // default to Hebrew
}

// Simple translation function
function translate(key, lang, replacements = {}) {
  const translations = {
    en: {
      notifVoteTitle: "New vote on your suggestion",
      notifVoteMessage: "{name} voted on the suggestion \"{title}\"",
      notifAcceptedTitle: "🎉 Your suggestion was accepted!",
      notifAcceptedMessage: "The suggestion \"{title}\" was accepted and added to the document",
      notifRejectedTitle: "Your suggestion was rejected",
      notifRejectedMessage: "The suggestion \"{title}\" was rejected by the document admin",
      notifNewSuggestionTitle: "New suggestion in document",
      notifNewSuggestionMessage: "{name} added a new suggestion in the document \"{title}\"",
      notifReplyTitle: "Reply to your comment",
      notifReplyMessage: "{name} replied to your comment",
      notifCommentTitle: "New comment",
      notifCommentMessageSuggestion: "{name} commented on your suggestion",
      notifCommentMessageSection: "{name} commented on your section",
    },
    he: {
      notifVoteTitle: "הצבעה חדשה על ההצעה שלך",
      notifVoteMessage: "{name} הצביע על ההצעה \"{title}\"",
      notifAcceptedTitle: "🎉 ההצעה שלך התקבלה!",
      notifAcceptedMessage: "ההצעה \"{title}\" התקבלה ונוספה למסמך",
      notifRejectedTitle: "ההצעה שלך נדחתה",
      notifRejectedMessage: "ההצעה \"{title}\" נדחתה על ידי מנהל המסמך",
      notifNewSuggestionTitle: "הצעה חדשה במסמך",
      notifNewSuggestionMessage: "{name} הוסיף הצעה חדשה במסמך \"{title}\"",
      notifReplyTitle: "תשובה לתגובה שלך",
      notifReplyMessage: "{name} השיב לתגובה שלך",
      notifCommentTitle: "תגובה חדשה",
      notifCommentMessageSuggestion: "{name} הגיב על ההצעה שלך",
      notifCommentMessageSection: "{name} הגיב על הסעיף שלך",
    },
    ar: {
      notifVoteTitle: "تصويت جديد على اقتراحك",
      notifVoteMessage: "{name} صوت على الاقتراح \"{title}\"",
      notifAcceptedTitle: "🎉 تم قبول اقتراحك!",
      notifAcceptedMessage: "تم قبول الاقتراح \"{title}\" وإضافته إلى المستند",
      notifRejectedTitle: "تم رفض اقتراحك",
      notifRejectedMessage: "تم رفض الاقتراح \"{title}\" من قبل مدير المستند",
      notifNewSuggestionTitle: "اقتراح جديد في المستند",
      notifNewSuggestionMessage: "{name} أضاف اقتراحًا جديدًا في المستند \"{title}\"",
      notifReplyTitle: "رد على تعليقك",
      notifReplyMessage: "{name} رد على تعليقك",
      notifCommentTitle: "تعليق جديد",
      notifCommentMessageSuggestion: "{name} علق على اقتراحك",
      notifCommentMessageSection: "{name} علق على قسمك",
    }
  };
  
  let text = translations[lang]?.[key] || translations['he'][key] || key;
  
  // Replace placeholders
  for (const [placeholder, value] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
  }
  
  return text;
}

/**
 * יצירת התראה למשתמש
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  relatedEntityId,
  relatedEntityType,
  actionUrl
}) {
  try {
    console.log('[NOTIFICATION] Creating notification:', {
      userId,
      type,
      title,
      message
    });
    
    const notification = await base44.entities.Notification.create({
      userId,
      type,
      title: String(title),
      message: String(message),
      relatedEntityId,
      relatedEntityType,
      actionUrl,
      read: false
    });
    
    console.log('[NOTIFICATION] Notification created successfully:', notification.id);
    return notification;
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
    throw error;
  }
}

/**
 * יצירת התראה על הצבעה חדשה
 */
export async function notifyVoteOnSuggestion({ suggestion, voterEmail }) {
  try {
    console.log('[NOTIFICATION] Vote notification triggered:', {
      suggestionId: suggestion.id,
      suggestionCreator: suggestion.created_by,
      voterEmail
    });
    
    const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
    if (suggestionCreatorList.length === 0) {
      console.log('[NOTIFICATION] Suggestion creator not found');
      return;
    }
    
    const suggestionCreator = suggestionCreatorList[0];
    
    // לא לשלוח התראה אם המצביע הוא יוצר ההצעה עצמו
    if (voterEmail === suggestion.created_by) {
      console.log('[NOTIFICATION] Voter is suggestion creator, skipping notification');
      return;
    }
    
    const voterList = await base44.entities.User.filter({ email: voterEmail });
    const voterName = voterList.length > 0 ? voterList[0].full_name : voterEmail;
    
    console.log('[NOTIFICATION] Creating vote notification for user:', suggestionCreator.id);
    
    const userLang = await getUserLanguage(suggestionCreator.id);
    
    await createNotification({
      userId: suggestionCreator.id,
      type: 'vote_on_suggestion',
      title: translate('notifVoteTitle', userLang),
      message: translate('notifVoteMessage', userLang, { name: voterName, title: suggestion.title }),
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`
    });
    
    console.log('[NOTIFICATION] Vote notification created successfully');
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}

/**
 * יצירת התראה על שינוי סטטוס הצעה
 */
export async function notifySuggestionStatusChange({ suggestion, newStatus }) {
  try {
    console.log('[NOTIFICATION] Status change notification triggered:', {
      suggestionId: suggestion.id,
      newStatus,
      suggestionCreator: suggestion.created_by
    });
    
    const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
    if (suggestionCreatorList.length === 0) {
      console.log('[NOTIFICATION] Suggestion creator not found');
      return;
    }
    
    const suggestionCreator = suggestionCreatorList[0];
    const userLang = await getUserLanguage(suggestionCreator.id);
    
    const statusKeys = {
      accepted: {
        titleKey: 'notifAcceptedTitle',
        messageKey: 'notifAcceptedMessage'
      },
      rejected: {
        titleKey: 'notifRejectedTitle',
        messageKey: 'notifRejectedMessage'
      }
    };
    
    const statusKey = statusKeys[newStatus];
    if (!statusKey) {
      console.log('[NOTIFICATION] No status message for:', newStatus);
      return;
    }
    
    console.log('[NOTIFICATION] Creating status change notification for user:', suggestionCreator.id);
    
    await createNotification({
      userId: suggestionCreator.id,
      type: newStatus === 'accepted' ? 'suggestion_accepted' : 'suggestion_rejected',
      title: translate(statusKey.titleKey, userLang),
      message: translate(statusKey.messageKey, userLang, { title: suggestion.title }),
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`
    });
    
    console.log('[NOTIFICATION] Status change notification created successfully');
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}

/**
 * יצירת התראה על הצעה חדשה במסמך
 */
export async function notifyNewSuggestion({ suggestion, document, currentUser }) {
  try {
    console.log('[NOTIFICATION] New suggestion notification triggered:', {
      suggestionId: suggestion.id,
      documentId: document.id,
      creator: currentUser.email
    });
    
    // מציאת כל המשתמשים שאינטראקציה עם המסמך
    const interactions = await base44.entities.UserInteraction.filter({ documentId: document.id });
    const interactedUserIds = interactions.map(i => i.userId).filter(id => id !== currentUser.id);
    
    if (interactedUserIds.length === 0) {
      console.log('[NOTIFICATION] No users to notify');
      return;
    }
    
    const uniqueUserIds = [...new Set(interactedUserIds)];
    const suggestionUrl = `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`;
    
    console.log('[NOTIFICATION] Creating notifications for', uniqueUserIds.length, 'users');
    
    for (const userId of uniqueUserIds) {
      const userLang = await getUserLanguage(userId);
      
      await createNotification({
        userId: userId,
        type: 'new_suggestion',
        title: translate('notifNewSuggestionTitle', userLang),
        message: translate('notifNewSuggestionMessage', userLang, { 
          name: currentUser.full_name, 
          title: document.title 
        }),
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl: suggestionUrl
      });
    }
    
    console.log('[NOTIFICATION] New suggestion notifications created successfully');
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}

/**
 * יצירת התראה על תגובה חדשה
 */
export async function notifyNewComment({ comment, targetEntity, targetEntityType, parentComment = null }) {
  try {
    console.log('[NOTIFICATION] Comment notification triggered:', {
      commentId: comment.id,
      targetEntityType,
      targetEntityId: targetEntity.id,
      commenter: comment.created_by,
      parentComment: parentComment?.id
    });
    
    // אם זו תשובה לתגובה - שלח התראה לבעל התגובה המקורית
    if (parentComment && comment.created_by !== parentComment.created_by) {
      const parentCommenterList = await base44.entities.User.filter({ email: parentComment.created_by });
      if (parentCommenterList.length > 0) {
        const parentCommenterId = parentCommenterList[0].id;
        
        const replierList = await base44.entities.User.filter({ email: comment.created_by });
        const replierName = replierList.length > 0 ? replierList[0].full_name : comment.created_by;
        
        console.log('[NOTIFICATION] Creating reply notification for parent comment owner:', parentCommenterId);
        
        const userLang = await getUserLanguage(parentCommenterId);
        
        await createNotification({
          userId: parentCommenterId,
          type: 'comment_reply',
          title: translate('notifReplyTitle', userLang),
          message: translate('notifReplyMessage', userLang, { name: replierName }),
          relatedEntityId: targetEntity.id,
          relatedEntityType: targetEntityType,
          actionUrl: targetEntityType === 'suggestion' 
            ? `${createPageUrl("SuggestionDetail")}?id=${targetEntity.id}`
            : `${createPageUrl("SectionHistory")}?sectionId=${targetEntity.id}`
        });
        
        console.log('[NOTIFICATION] Reply notification created successfully');
      }
    }
    
    // מציאת בעל הישות שעליה הגיבו
    let ownerId;
    
    if (targetEntityType === 'suggestion') {
      const ownerList = await base44.entities.User.filter({ email: targetEntity.created_by });
      if (ownerList.length === 0) {
        console.log('[NOTIFICATION] Target entity owner not found');
        return;
      }
      ownerId = ownerList[0].id;
    } else if (targetEntityType === 'section') {
      const ownerList = await base44.entities.User.filter({ id: targetEntity.lastEditedBy });
      if (ownerList.length === 0) {
        console.log('[NOTIFICATION] Target entity owner not found');
        return;
      }
      ownerId = ownerList[0].id;
    }
    
    // לא לשלוח התראה אם המגיב הוא בעל הישות עצמו
    if (comment.created_by === (targetEntity.created_by || targetEntity.lastEditedBy)) {
      console.log('[NOTIFICATION] Commenter is entity owner, skipping notification');
      return;
    }
    
    const commenterList = await base44.entities.User.filter({ email: comment.created_by });
    const commenterName = commenterList.length > 0 ? commenterList[0].full_name : comment.created_by;
    
    console.log('[NOTIFICATION] Creating comment notification for user:', ownerId);
    
    const userLang = await getUserLanguage(ownerId);
    const messageKey = targetEntityType === 'suggestion' ? 'notifCommentMessageSuggestion' : 'notifCommentMessageSection';
    
    await createNotification({
      userId: ownerId,
      type: targetEntityType === 'suggestion' ? 'suggestion_comment' : 'section_comment',
      title: translate('notifCommentTitle', userLang),
      message: translate(messageKey, userLang, { name: commenterName }),
      relatedEntityId: targetEntity.id,
      relatedEntityType: targetEntityType,
      actionUrl: targetEntityType === 'suggestion' 
        ? `${createPageUrl("SuggestionDetail")}?id=${targetEntity.id}`
        : `${createPageUrl("SectionHistory")}?sectionId=${targetEntity.id}`
    });
    
    console.log('[NOTIFICATION] Comment notification created successfully');
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}