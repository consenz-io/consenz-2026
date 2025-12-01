import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

// Cache for users to reduce API calls
const userCache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function getCachedUsers() {
  const cacheKey = 'all_users';
  const cached = userCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const users = await base44.entities.User.list();
  userCache.set(cacheKey, { data: users, timestamp: Date.now() });
  return users;
}

function getUserFromCache(users, { id, email }) {
  if (id) return users.find(u => u.id === id);
  if (email) return users.find(u => u.email === email);
  return null;
}

// Simple translation function
function translate(key, lang, replacements = {}) {
  const translations = {
    en: {
      notifVoteTitle: "New vote on your suggestion",
      notifVoteMessage: "{name} voted on the suggestion \"{title}\"",
      notifAcceptedTitle: "🎉 Your suggestion was accepted!",
      notifAcceptedMessage: "The suggestion \"{title}\" was accepted and added to the document",
      notifAcceptedVoterTitle: "A suggestion you supported was accepted!",
      notifAcceptedVoterMessage: "The suggestion \"{title}\" you voted for was accepted",
      notifRejectedTitle: "Your suggestion was rejected",
      notifRejectedMessage: "The suggestion \"{title}\" was rejected by the document admin",
      notifNewSuggestionTitle: "New suggestion in document",
      notifNewSuggestionMessage: "{name} added a new suggestion in the document \"{title}\"",
      notifReplyTitle: "Reply to your comment",
      notifReplyMessage: "{name} replied to your comment",
      notifCommentTitle: "New comment",
      notifCommentMessageSuggestion: "{name} commented on your suggestion",
      notifCommentMessageSection: "{name} commented on your section",
      notifCommentOnDiscussion: "{name} commented on a suggestion you participated in",
      notifDocumentCommentTitle: "New comment in document discussion",
      notifDocumentCommentMessage: "{name} commented in the document \"{title}\"",
    },
    he: {
      notifVoteTitle: "הצבעה חדשה על ההצעה שלך",
      notifVoteMessage: "{name} הצביע על ההצעה \"{title}\"",
      notifAcceptedTitle: "🎉 ההצעה שלך התקבלה!",
      notifAcceptedMessage: "ההצעה \"{title}\" התקבלה ונוספה למסמך",
      notifAcceptedVoterTitle: "הצעה שתמכת בה התקבלה!",
      notifAcceptedVoterMessage: "ההצעה \"{title}\" שהצבעת בעדה התקבלה",
      notifRejectedTitle: "ההצעה שלך נדחתה",
      notifRejectedMessage: "ההצעה \"{title}\" נדחתה על ידי מנהל המסמך",
      notifNewSuggestionTitle: "הצעה חדשה במסמך",
      notifNewSuggestionMessage: "{name} הוסיף הצעה חדשה במסמך \"{title}\"",
      notifReplyTitle: "תשובה לתגובה שלך",
      notifReplyMessage: "{name} השיב לתגובה שלך",
      notifCommentTitle: "תגובה חדשה",
      notifCommentMessageSuggestion: "{name} הגיב על ההצעה שלך",
      notifCommentMessageSection: "{name} הגיב על הסעיף שלך",
      notifCommentOnDiscussion: "{name} הגיב על הצעה שהשתתפת בה",
      notifDocumentCommentTitle: "תגובה חדשה בדיון המסמך",
      notifDocumentCommentMessage: "{name} הגיב בדיון על המסמך \"{title}\"",
    },
    ar: {
      notifVoteTitle: "تصويت جديد على اقتراحك",
      notifVoteMessage: "{name} صوت على الاقتراح \"{title}\"",
      notifAcceptedTitle: "🎉 تم قبول اقتراحك!",
      notifAcceptedMessage: "تم قبول الاقتراح \"{title}\" وإضافته إلى المستند",
      notifAcceptedVoterTitle: "تم قبول اقتراح دعمته!",
      notifAcceptedVoterMessage: "تم قبول الاقتراح \"{title}\" الذي صوتت له",
      notifRejectedTitle: "تم رفض اقتراحك",
      notifRejectedMessage: "تم رفض الاقتراح \"{title}\" من قبل مدير المستند",
      notifNewSuggestionTitle: "اقتراح جديد في المستند",
      notifNewSuggestionMessage: "{name} أضاف اقتراحًا جديدًا في المستند \"{title}\"",
      notifReplyTitle: "رد على تعليقك",
      notifReplyMessage: "{name} رد على تعليقك",
      notifCommentTitle: "تعليق جديد",
      notifCommentMessageSuggestion: "{name} علق على اقتراحك",
      notifCommentMessageSection: "{name} علق على قسمك",
      notifCommentOnDiscussion: "{name} علق على اقتراح شاركت فيه",
      notifDocumentCommentTitle: "تعليق جديد في نقاش المستند",
      notifDocumentCommentMessage: "{name} علق في نقاش المستند \"{title}\"",
    }
  };
  
  let text = translations[lang]?.[key] || translations['he'][key] || key;
  
  // Replace placeholders
  for (const [placeholder, value] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
  }
  
  return text;
}

// Helper to get document admins
async function getDocumentAdmins(documentId) {
  try {
    const admins = await base44.entities.DocumentAdmin.filter({ documentId });
    return admins.map(a => a.userId);
  } catch (error) {
    console.error('Error getting document admins:', error);
    return [];
  }
}

// Helper to get document creator - uses cached users
async function getDocumentCreator(documentId, users, documents = null) {
  try {
    let docs = documents;
    if (!docs) {
      docs = await base44.entities.Document.filter({ id: documentId });
    }
    if (docs.length > 0 && docs[0].created_by) {
      return getUserFromCache(users, { email: docs[0].created_by });
    }
    return null;
  } catch (error) {
    console.error('Error getting document creator:', error);
    return null;
  }
}

// Batch create notifications for efficiency
async function batchCreateNotifications(notifications) {
  // Create all notifications in parallel
  await Promise.all(notifications.map(n => 
    base44.entities.Notification.create({ ...n, read: false })
  ));
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
export async function notifyVoteOnSuggestion({ suggestion, voterEmail, voterName }) {
  try {
    if (voterEmail === suggestion.created_by) return;
    
    const users = await getCachedUsers();
    const suggestionCreator = getUserFromCache(users, { email: suggestion.created_by });
    if (!suggestionCreator) return;
    
    const displayName = voterName || getUserFromCache(users, { email: voterEmail })?.full_name || voterEmail;
    const userLang = suggestionCreator.preferredLanguage || 'he';
    
    await createNotification({
      userId: suggestionCreator.id,
      type: 'vote_on_suggestion',
      title: translate('notifVoteTitle', userLang),
      message: translate('notifVoteMessage', userLang, { name: displayName, title: suggestion.title }),
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`
    });
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}

/**
 * יצירת התראה על שינוי סטטוס הצעה
 */
export async function notifySuggestionStatusChange({ suggestion, newStatus }) {
  try {
    const users = await getCachedUsers();
    const notifiedUserIds = new Set();
    const notifications = [];
    const actionUrl = `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`;
    
    const statusKeys = {
      accepted: { titleKey: 'notifAcceptedTitle', messageKey: 'notifAcceptedMessage' },
      rejected: { titleKey: 'notifRejectedTitle', messageKey: 'notifRejectedMessage' }
    };
    const statusKey = statusKeys[newStatus];
    if (!statusKey) return;
    
    // 1. יוצר ההצעה
    const suggestionCreator = getUserFromCache(users, { email: suggestion.created_by });
    if (suggestionCreator) {
      notifiedUserIds.add(suggestionCreator.id);
      const userLang = suggestionCreator.preferredLanguage || 'he';
      notifications.push({
        userId: suggestionCreator.id,
        type: newStatus === 'accepted' ? 'suggestion_accepted' : 'suggestion_rejected',
        title: translate(statusKey.titleKey, userLang),
        message: translate(statusKey.messageKey, userLang, { title: suggestion.title }),
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl
      });
    }
    
    // 2. אם התקבלה - יוצר המסמך, מנהלים, ומצביעי pro
    if (newStatus === 'accepted') {
      const [adminIds, proVotes] = await Promise.all([
        getDocumentAdmins(suggestion.documentId),
        base44.entities.Vote.filter({ suggestionId: suggestion.id, vote: 'pro' })
      ]);
      
      const docCreator = await getDocumentCreator(suggestion.documentId, users);
      if (docCreator && !notifiedUserIds.has(docCreator.id)) {
        notifiedUserIds.add(docCreator.id);
        const userLang = docCreator.preferredLanguage || 'he';
        notifications.push({
          userId: docCreator.id,
          type: 'suggestion_accepted',
          title: translate('notifAcceptedTitle', userLang),
          message: translate('notifAcceptedMessage', userLang, { title: suggestion.title }),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl
        });
      }
      
      for (const adminId of adminIds) {
        if (notifiedUserIds.has(adminId)) continue;
        notifiedUserIds.add(adminId);
        const admin = getUserFromCache(users, { id: adminId });
        const userLang = admin?.preferredLanguage || 'he';
        notifications.push({
          userId: adminId,
          type: 'suggestion_accepted',
          title: translate('notifAcceptedTitle', userLang),
          message: translate('notifAcceptedMessage', userLang, { title: suggestion.title }),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl
        });
      }
      
      for (const vote of proVotes) {
        if (notifiedUserIds.has(vote.userId)) continue;
        notifiedUserIds.add(vote.userId);
        const voter = getUserFromCache(users, { id: vote.userId });
        const userLang = voter?.preferredLanguage || 'he';
        notifications.push({
          userId: vote.userId,
          type: 'suggestion_accepted',
          title: translate('notifAcceptedVoterTitle', userLang),
          message: translate('notifAcceptedVoterMessage', userLang, { title: suggestion.title }),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl
        });
      }
    }
    
    await batchCreateNotifications(notifications);
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
    
    const notifiedUsers = new Set();
    notifiedUsers.add(currentUser.id); // לא לשלוח ליוצר ההצעה עצמו
    
    // בנה URL שמכוון לסעיף הספציפי
    const actionUrl = suggestion.sectionId 
      ? `${createPageUrl("DocumentView")}?id=${document.id}&scrollTo=${suggestion.sectionId}`
      : `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`;
    
    // 1. שלח ליוצר המסמך
    const docCreator = await getDocumentCreator(document.id);
    if (docCreator && !notifiedUsers.has(docCreator.id)) {
      notifiedUsers.add(docCreator.id);
      const userLang = await getUserLanguage(docCreator.id);
      await createNotification({
        userId: docCreator.id,
        type: 'new_suggestion',
        title: translate('notifNewSuggestionTitle', userLang),
        message: translate('notifNewSuggestionMessage', userLang, { 
          name: currentUser.full_name, 
          title: document.title 
        }),
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl
      });
    }
    
    // 2. שלח למנהלי המסמך
    const adminIds = await getDocumentAdmins(document.id);
    for (const adminId of adminIds) {
      if (notifiedUsers.has(adminId)) continue;
      notifiedUsers.add(adminId);
      
      const userLang = await getUserLanguage(adminId);
      await createNotification({
        userId: adminId,
        type: 'new_suggestion',
        title: translate('notifNewSuggestionTitle', userLang),
        message: translate('notifNewSuggestionMessage', userLang, { 
          name: currentUser.full_name, 
          title: document.title 
        }),
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl
      });
    }
    
    console.log('[NOTIFICATION] New suggestion notifications created for', notifiedUsers.size - 1, 'users');
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
    
    const commenterList = await base44.entities.User.filter({ email: comment.created_by });
    const commenterName = commenterList.length > 0 ? commenterList[0].full_name : comment.created_by;
    
    // Set to track users we've already notified (to avoid duplicate notifications)
    const notifiedUsers = new Set();
    notifiedUsers.add(comment.created_by); // Don't notify the commenter themselves
    
    // בנה URL מתאים
    let actionUrl;
    let documentId;
    
    if (targetEntityType === 'suggestion') {
      actionUrl = `${createPageUrl("SuggestionDetail")}?id=${targetEntity.id}`;
      documentId = targetEntity.documentId;
    } else if (targetEntityType === 'section') {
      documentId = targetEntity.documentId;
      actionUrl = `${createPageUrl("DocumentView")}?id=${documentId}&scrollTo=${targetEntity.id}`;
    }
    
    // אם זו תשובה לתגובה - שלח התראה לבעל התגובה המקורית
    if (parentComment && comment.created_by !== parentComment.created_by) {
      const parentCommenterList = await base44.entities.User.filter({ email: parentComment.created_by });
      if (parentCommenterList.length > 0) {
        const parentCommenterId = parentCommenterList[0].id;
        notifiedUsers.add(parentComment.created_by);
        
        const userLang = await getUserLanguage(parentCommenterId);
        
        await createNotification({
          userId: parentCommenterId,
          type: 'comment_reply',
          title: translate('notifReplyTitle', userLang),
          message: translate('notifReplyMessage', userLang, { name: commenterName }),
          relatedEntityId: targetEntity.id,
          relatedEntityType: targetEntityType,
          actionUrl
        });
      }
    }
    
    // מציאת בעל הישות שעליה הגיבו
    let ownerId;
    let ownerEmail;
    
    if (targetEntityType === 'suggestion') {
      ownerEmail = targetEntity.created_by;
      const ownerList = await base44.entities.User.filter({ email: ownerEmail });
      if (ownerList.length > 0) {
        ownerId = ownerList[0].id;
      }
    } else if (targetEntityType === 'section') {
      if (targetEntity.lastEditedBy) {
        const ownerList = await base44.entities.User.filter({ id: targetEntity.lastEditedBy });
        if (ownerList.length > 0) {
          ownerId = ownerList[0].id;
          ownerEmail = ownerList[0].email;
        }
      }
    }
    
    // שלח התראה לבעל הישות אם עדיין לא קיבל התראה
    if (ownerId && ownerEmail && !notifiedUsers.has(ownerEmail)) {
      notifiedUsers.add(ownerEmail);
      
      const userLang = await getUserLanguage(ownerId);
      const messageKey = targetEntityType === 'suggestion' ? 'notifCommentMessageSuggestion' : 'notifCommentMessageSection';
      
      await createNotification({
        userId: ownerId,
        type: targetEntityType === 'suggestion' ? 'suggestion_comment' : 'section_comment',
        title: translate('notifCommentTitle', userLang),
        message: translate(messageKey, userLang, { name: commenterName }),
        relatedEntityId: targetEntity.id,
        relatedEntityType: targetEntityType,
        actionUrl
      });
    }
    
    // שלח ליוצר המסמך ומנהלים
    if (documentId) {
      const docCreator = await getDocumentCreator(documentId);
      if (docCreator && !notifiedUsers.has(docCreator.email)) {
        notifiedUsers.add(docCreator.email);
        const userLang = await getUserLanguage(docCreator.id);
        const messageKey = targetEntityType === 'suggestion' ? 'notifCommentMessageSuggestion' : 'notifCommentMessageSection';
        
        await createNotification({
          userId: docCreator.id,
          type: targetEntityType === 'suggestion' ? 'suggestion_comment' : 'section_comment',
          title: translate('notifCommentTitle', userLang),
          message: translate(messageKey, userLang, { name: commenterName }),
          relatedEntityId: targetEntity.id,
          relatedEntityType: targetEntityType,
          actionUrl
        });
      }
      
      const adminIds = await getDocumentAdmins(documentId);
      for (const adminId of adminIds) {
        // מצא את האימייל של המנהל
        const adminUsers = await base44.entities.User.filter({ id: adminId });
        if (adminUsers.length === 0) continue;
        const adminEmail = adminUsers[0].email;
        
        if (notifiedUsers.has(adminEmail)) continue;
        notifiedUsers.add(adminEmail);
        
        const userLang = await getUserLanguage(adminId);
        const messageKey = targetEntityType === 'suggestion' ? 'notifCommentMessageSuggestion' : 'notifCommentMessageSection';
        
        await createNotification({
          userId: adminId,
          type: targetEntityType === 'suggestion' ? 'suggestion_comment' : 'section_comment',
          title: translate('notifCommentTitle', userLang),
          message: translate(messageKey, userLang, { name: commenterName }),
          relatedEntityId: targetEntity.id,
          relatedEntityType: targetEntityType,
          actionUrl
        });
      }
    }
    
    // שלח התראות לכל מי שהגיב על ההצעה/סעיף (מלבד מי שכבר קיבל התראה)
    if (targetEntityType === 'suggestion' || targetEntityType === 'section') {
      const allComments = await base44.entities.Comment.filter({
        rootEntityType: targetEntityType,
        rootEntityId: targetEntity.id
      });
      
      // מציאת כל המשתמשים הייחודיים שהגיבו
      const commentersEmails = [...new Set(allComments.map(c => c.created_by))];
      
      for (const commenterEmail of commentersEmails) {
        if (notifiedUsers.has(commenterEmail)) continue;
        notifiedUsers.add(commenterEmail);
        
        const userList = await base44.entities.User.filter({ email: commenterEmail });
        if (userList.length === 0) continue;
        
        const userId = userList[0].id;
        const userLang = await getUserLanguage(userId);
        
        await createNotification({
          userId: userId,
          type: targetEntityType === 'suggestion' ? 'suggestion_comment' : 'section_comment',
          title: translate('notifCommentTitle', userLang),
          message: translate('notifCommentOnDiscussion', userLang, { name: commenterName }),
          relatedEntityId: targetEntity.id,
          relatedEntityType: targetEntityType,
          actionUrl
        });
      }
    }
    
    console.log('[NOTIFICATION] Comment notification process completed');
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}

/**
 * יצירת התראה על תגובה חדשה בדיון כללי של מסמך
 */
export async function notifyNewDocumentComment({ comment, document, parentComment = null }) {
  try {
    console.log('[NOTIFICATION] Document comment notification triggered:', {
      commentId: comment.id,
      documentId: document.id,
      commenter: comment.created_by,
      parentComment: parentComment?.id
    });
    
    const commenterList = await base44.entities.User.filter({ email: comment.created_by });
    const commenterName = commenterList.length > 0 ? commenterList[0].full_name : comment.created_by;
    
    // Set to track users we've already notified
    const notifiedUsers = new Set();
    notifiedUsers.add(comment.created_by); // Don't notify the commenter themselves
    
    const actionUrl = `${createPageUrl("DocumentView")}?id=${document.id}`;
    
    // אם זו תשובה לתגובה - שלח התראה לבעל התגובה המקורית
    if (parentComment && comment.created_by !== parentComment.created_by) {
      const parentCommenterList = await base44.entities.User.filter({ email: parentComment.created_by });
      if (parentCommenterList.length > 0) {
        const parentCommenterId = parentCommenterList[0].id;
        notifiedUsers.add(parentComment.created_by);
        
        const userLang = await getUserLanguage(parentCommenterId);
        
        await createNotification({
          userId: parentCommenterId,
          type: 'comment_reply',
          title: translate('notifReplyTitle', userLang),
          message: translate('notifReplyMessage', userLang, { name: commenterName }),
          relatedEntityId: document.id,
          relatedEntityType: 'document',
          actionUrl
        });
      }
    }
    
    // שלח התראה ליוצר המסמך
    if (document.created_by && !notifiedUsers.has(document.created_by)) {
      const creatorList = await base44.entities.User.filter({ email: document.created_by });
      if (creatorList.length > 0) {
        const creatorId = creatorList[0].id;
        notifiedUsers.add(document.created_by);
        
        const userLang = await getUserLanguage(creatorId);
        
        await createNotification({
          userId: creatorId,
          type: 'document_comment',
          title: translate('notifDocumentCommentTitle', userLang),
          message: translate('notifDocumentCommentMessage', userLang, { name: commenterName, title: document.title }),
          relatedEntityId: document.id,
          relatedEntityType: 'document',
          actionUrl
        });
      }
    }
    
    // שלח למנהלי המסמך
    const adminIds = await getDocumentAdmins(document.id);
    for (const adminId of adminIds) {
      const adminUsers = await base44.entities.User.filter({ id: adminId });
      if (adminUsers.length === 0) continue;
      const adminEmail = adminUsers[0].email;
      
      if (notifiedUsers.has(adminEmail)) continue;
      notifiedUsers.add(adminEmail);
      
      const userLang = await getUserLanguage(adminId);
      
      await createNotification({
        userId: adminId,
        type: 'document_comment',
        title: translate('notifDocumentCommentTitle', userLang),
        message: translate('notifDocumentCommentMessage', userLang, { name: commenterName, title: document.title }),
        relatedEntityId: document.id,
        relatedEntityType: 'document',
        actionUrl
      });
    }
    
    // שלח התראות לכל מי שהשתתף בדיון הכללי של המסמך
    const allDocumentComments = await base44.entities.Comment.filter({
      rootEntityType: 'document',
      rootEntityId: document.id
    });
    
    const commentersEmails = [...new Set(allDocumentComments.map(c => c.created_by))];
    
    for (const commenterEmail of commentersEmails) {
      if (notifiedUsers.has(commenterEmail)) continue;
      notifiedUsers.add(commenterEmail);
      
      const userList = await base44.entities.User.filter({ email: commenterEmail });
      if (userList.length === 0) continue;
      
      const userId = userList[0].id;
      const userLang = await getUserLanguage(userId);
      
      await createNotification({
        userId: userId,
        type: 'document_comment',
        title: translate('notifDocumentCommentTitle', userLang),
        message: translate('notifDocumentCommentMessage', userLang, { name: commenterName, title: document.title }),
        relatedEntityId: document.id,
        relatedEntityType: 'document',
        actionUrl
      });
    }
    
    console.log('[NOTIFICATION] Document comment notifications completed');
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}