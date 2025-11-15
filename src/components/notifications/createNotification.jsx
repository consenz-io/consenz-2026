import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

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
      title,
      message,
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
    
    await createNotification({
      userId: suggestionCreator.id,
      type: 'vote_on_suggestion',
      title: 'הצבעה חדשה על ההצעה שלך',
      message: `${voterName} הצביע על ההצעה "${suggestion.title}"`,
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
    
    const statusMessages = {
      accepted: {
        title: '🎉 ההצעה שלך התקבלה!',
        message: `ההצעה "${suggestion.title}" התקבלה ונוספה למסמך`
      },
      rejected: {
        title: 'ההצעה שלך נדחתה',
        message: `ההצעה "${suggestion.title}" נדחתה על ידי מנהל המסמך`
      }
    };
    
    const statusMessage = statusMessages[newStatus];
    if (!statusMessage) {
      console.log('[NOTIFICATION] No status message for:', newStatus);
      return;
    }
    
    console.log('[NOTIFICATION] Creating status change notification for user:', suggestionCreator.id);
    
    await createNotification({
      userId: suggestionCreator.id,
      type: newStatus === 'accepted' ? 'suggestion_accepted' : 'suggestion_rejected',
      title: statusMessage.title,
      message: statusMessage.message,
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
 * יצירת התראה על תגובה חדשה
 */
export async function notifyNewComment({ comment, targetEntity, targetEntityType }) {
  try {
    console.log('[NOTIFICATION] Comment notification triggered:', {
      commentId: comment.id,
      targetEntityType,
      targetEntityId: targetEntity.id,
      commenter: comment.created_by
    });
    
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
    
    const entityNames = {
      suggestion: 'ההצעה',
      section: 'הסעיף'
    };
    
    console.log('[NOTIFICATION] Creating comment notification for user:', ownerId);
    
    await createNotification({
      userId: ownerId,
      type: targetEntityType === 'suggestion' ? 'suggestion_comment' : 'section_comment',
      title: 'תגובה חדשה',
      message: `${commenterName} הגיב על ${entityNames[targetEntityType]} שלך`,
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