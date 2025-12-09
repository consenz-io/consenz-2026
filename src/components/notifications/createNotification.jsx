import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

// Cache for users and public profiles to reduce API calls
const userCache = new Map();
const CACHE_TTL = 60000; // 1 minute

// Clean up old cache entries periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of userCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        userCache.delete(key);
      }
    }
  }, CACHE_TTL);
}

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

async function getCachedPublicProfiles() {
  const cacheKey = 'public_profiles';
  const cached = userCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const profiles = await base44.entities.UserPublicProfile.list();
  userCache.set(cacheKey, { data: profiles, timestamp: Date.now() });
  return profiles;
}

function getUserFromCache(users, publicProfiles, { id, email }) {
  // First try public profile (accessible to all)
  if (email) {
    const profile = publicProfiles.find(p => p.email === email);
    if (profile) {
      return { id: profile.userId, email: profile.email, full_name: profile.fullName };
    }
  }
  if (id) {
    const profile = publicProfiles.find(p => p.userId === id);
    if (profile) {
      return { id: profile.userId, email: profile.email, full_name: profile.fullName };
    }
  }
  
  // Fallback to User entity
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

// Helper to get document creator - uses cached users and profiles
async function getDocumentCreator(documentId, users, publicProfiles, documents = null) {
  try {
    let docs = documents;
    if (!docs) {
      docs = await base44.entities.Document.filter({ id: documentId });
    }
    if (docs.length > 0 && docs[0].created_by) {
      return getUserFromCache(users, publicProfiles, { email: docs[0].created_by });
    }
    return null;
  } catch (error) {
    console.error('Error getting document creator:', error);
    return null;
  }
}

// Batch create notifications for efficiency
async function batchCreateNotifications(notifications) {
  if (!notifications || notifications.length === 0) return;
  
  try {
    // Create all notifications in parallel
    await Promise.all(notifications.map(n => 
      base44.entities.Notification.create({ ...n, read: false }).catch(err => {
        console.error('[NOTIFICATION ERROR] Failed to create notification:', err);
        return null;
      })
    ));
  } catch (error) {
    console.error('[NOTIFICATION ERROR] Batch create failed:', error);
  }
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
    if (!userId) {
      console.warn('[NOTIFICATION] Missing userId, skipping notification');
      return null;
    }
    
    // Validate and sanitize actionUrl
    const validActionUrl = (actionUrl && typeof actionUrl === 'string' && actionUrl.length > 0) 
      ? actionUrl 
      : null;
    
    if (!validActionUrl) {
      console.warn('[NOTIFICATION] No valid actionUrl provided:', { type, relatedEntityType, relatedEntityId });
    }
    
    const notification = await base44.entities.Notification.create({
      userId,
      type,
      title,
      message,
      relatedEntityId,
      relatedEntityType,
      actionUrl: validActionUrl,
      read: false
    });
    
    return notification;
  } catch (error) {
    console.error('[NOTIFICATION ERROR] Failed to create notification:', error);
    // Don't throw - notifications should not block main flow
    return null;
  }
}

/**
 * יצירת התראה על הצבעה חדשה
 */
export async function notifyVoteOnSuggestion({ suggestion, voterEmail, voterName }) {
  try {
    // Don't notify if voter is the suggestion creator
    if (voterEmail === suggestion.created_by) return;
    
    // Validate required data
    if (!suggestion?.id || !suggestion?.created_by || !voterEmail) {
      console.error('[NOTIFICATION ERROR] Missing required data for vote notification:', { suggestion, voterEmail });
      return;
    }
    
    const [users, publicProfiles] = await Promise.all([
      getCachedUsers(),
      getCachedPublicProfiles()
    ]);
    
    const suggestionCreator = getUserFromCache(users, publicProfiles, { email: suggestion.created_by });
    if (!suggestionCreator?.id) {
      console.error('[NOTIFICATION ERROR] Suggestion creator not found:', suggestion.created_by);
      return;
    }
    
    const displayName = voterName || getUserFromCache(users, publicProfiles, { email: voterEmail })?.full_name || voterEmail.split('@')[0];
    const userLang = suggestionCreator.preferredLanguage || 'he';
    
    await createNotification({
      userId: suggestionCreator.id,
      type: 'vote_on_suggestion',
      title: translate('notifVoteTitle', userLang),
      message: translate('notifVoteMessage', userLang, { name: displayName, title: suggestion.title || 'הצעה' }),
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: createPageUrl("SuggestionDetail") + `?id=${suggestion.id}`
    });
  } catch (error) {
    console.error('[NOTIFICATION ERROR] notifyVoteOnSuggestion failed:', error);
  }
}

/**
 * יצירת התראה על שינוי סטטוס הצעה
 */
export async function notifySuggestionStatusChange({ suggestion, newStatus }) {
  try {
    if (!suggestion || !suggestion.id) {
      console.error('[NOTIFICATION ERROR] Invalid suggestion:', suggestion);
      return;
    }
    
    if (!suggestion.created_by) {
      console.error('[NOTIFICATION ERROR] Suggestion missing created_by:', suggestion.id);
      return;
    }
    
    const notifiedUserIds = new Set();
    const notifications = [];
    const actionUrl = createPageUrl("SuggestionDetail") + `?id=${suggestion.id}`;
    
    const statusKeys = {
      accepted: { titleKey: 'notifAcceptedTitle', messageKey: 'notifAcceptedMessage' },
      rejected: { titleKey: 'notifRejectedTitle', messageKey: 'notifRejectedMessage' }
    };
    const statusKey = statusKeys[newStatus];
    if (!statusKey) {
      console.error('[NOTIFICATION ERROR] Invalid status:', newStatus);
      return;
    }
    
    const suggestionTitle = suggestion.title || 'הצעה ללא כותרת';
    
    // 1. יוצר ההצעה - שליפה ישירה מה-DB
    console.log('[NOTIFICATION] Looking for suggestion creator:', suggestion.created_by);
    const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
    console.log('[NOTIFICATION] Found users:', suggestionCreatorList?.length || 0, suggestionCreatorList?.map(u => u.email));
    const suggestionCreator = suggestionCreatorList?.[0];
    
    if (suggestionCreator) {
      console.log('[NOTIFICATION] Found creator:', suggestionCreator.email, 'ID:', suggestionCreator.id);
      notifiedUserIds.add(suggestionCreator.id);
      const userLang = suggestionCreator.preferredLanguage || 'he';
      notifications.push({
        userId: suggestionCreator.id,
        type: newStatus === 'accepted' ? 'suggestion_accepted' : 'suggestion_rejected',
        title: translate(statusKey.titleKey, userLang),
        message: translate(statusKey.messageKey, userLang, { title: suggestionTitle }),
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl
      });
      console.log('[NOTIFICATION] Added notification for suggestion creator:', suggestionCreator.email);
    } else {
      console.error('[NOTIFICATION ERROR] Suggestion creator not found in DB:', suggestion.created_by);
      console.error('[NOTIFICATION ERROR] suggestionCreatorList was:', suggestionCreatorList);
      return;
    }
    
    // 2. אם התקבלה - יוצר המסמך, מנהלים, ומצביעי pro
    if (newStatus === 'accepted') {
      const [adminIds, proVotes, publicProfiles] = await Promise.all([
        getDocumentAdmins(suggestion.documentId),
        base44.entities.Vote.filter({ suggestionId: suggestion.id, vote: 'pro' }),
        getCachedPublicProfiles()
      ]);
      
      // שלוף רק משתמשים רלוונטיים במקום כולם
      const relevantUserIds = [...new Set([
        ...adminIds,
        ...proVotes.map(v => v.userId)
      ].filter(Boolean))];
      
      const allUsers = relevantUserIds.length > 0 
        ? await base44.entities.User.filter({ id: { $in: relevantUserIds } })
        : [];
      
      const docCreator = await getDocumentCreator(suggestion.documentId, allUsers, publicProfiles);
      if (docCreator && !notifiedUserIds.has(docCreator.id)) {
        notifiedUserIds.add(docCreator.id);
        const userLang = docCreator.preferredLanguage || 'he';
        notifications.push({
          userId: docCreator.id,
          type: 'suggestion_accepted',
          title: translate('notifAcceptedTitle', userLang),
          message: translate('notifAcceptedMessage', userLang, { title: suggestionTitle }),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl
        });
      }
      
      for (const adminId of adminIds) {
        if (notifiedUserIds.has(adminId)) continue;
        notifiedUserIds.add(adminId);
        const admin = getUserFromCache(allUsers, publicProfiles, { id: adminId });
        const userLang = admin?.preferredLanguage || 'he';
        notifications.push({
          userId: adminId,
          type: 'suggestion_accepted',
          title: translate('notifAcceptedTitle', userLang),
          message: translate('notifAcceptedMessage', userLang, { title: suggestionTitle }),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl
        });
      }
      
      for (const vote of proVotes) {
        if (notifiedUserIds.has(vote.userId)) continue;
        notifiedUserIds.add(vote.userId);
        const voter = getUserFromCache(allUsers, publicProfiles, { id: vote.userId });
        const userLang = voter?.preferredLanguage || 'he';
        notifications.push({
          userId: vote.userId,
          type: 'suggestion_accepted',
          title: translate('notifAcceptedVoterTitle', userLang),
          message: translate('notifAcceptedVoterMessage', userLang, { title: suggestionTitle }),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl
        });
      }
    }
    
    if (notifications.length > 0) {
      console.log('[NOTIFICATION] Creating', notifications.length, 'notifications for suggestion:', suggestion.id);
      console.log('[NOTIFICATION] Notifications data:', JSON.stringify(notifications, null, 2));
      await batchCreateNotifications(notifications);
      console.log('[NOTIFICATION] Successfully created notifications');
    } else {
      console.warn('[NOTIFICATION] No notifications to create for suggestion:', suggestion.id);
      console.warn('[NOTIFICATION] notifiedUserIds:', Array.from(notifiedUserIds));
    }
  } catch (error) {
    console.error('[NOTIFICATION ERROR] Failed to send notifications:', error);
    console.error('[NOTIFICATION ERROR] Stack:', error.stack);
    throw error; // זורקים את השגיאה כדי שנראה אותה
  }
}

/**
 * יצירת התראה על הצעה חדשה במסמך - לכל המשתתפים
 */
export async function notifyNewSuggestion({ suggestion, document, currentUser }) {
  try {
    // Validate required data
    if (!suggestion?.id || !document?.id || !currentUser?.email) {
      console.error('[NOTIFICATION ERROR] Missing required data for new suggestion notification:', { suggestion, document, currentUser });
      return;
    }
    
    // שליפת כל הנתונים - מסוננים למסמך הספציפי לביצועים
    const [users, publicProfiles, allSuggestions, allArguments, sections] = await Promise.all([
      getCachedUsers(),
      getCachedPublicProfiles(),
      base44.entities.Suggestion.filter({ documentId: document.id }),
      base44.entities.Argument.list(),
      base44.entities.Section.filter({ documentId: document.id })
    ]);

    // שליפת מצביעים ומגיבים - רק אלה שקשורים למסמך זה
    const [allVotes, allComments] = await Promise.all([
      base44.entities.Vote.filter({ documentId: document.id }),
      base44.entities.Comment.list()
    ]);

    // חישוב כל המשתתפים במסמך
    const participantEmails = new Set();
    
    // יוצר המסמך
    if (document.created_by) participantEmails.add(document.created_by);
    
    // יוצרי הצעות
    allSuggestions.forEach(s => {
      if (s.created_by) participantEmails.add(s.created_by);
    });
    
    // מצביעים (רק על הצעות במסמך זה)
    const userIdToEmail = {};
    users.forEach(u => { userIdToEmail[u.id] = u.email; });
    allVotes.forEach(v => {
      if (userIdToEmail[v.userId]) participantEmails.add(userIdToEmail[v.userId]);
    });
    
    // כותבי טיעונים (רק על הצעות במסמך זה)
    const argumentsInDoc = allArguments.filter(arg => suggestionIds.includes(arg.suggestionId));
    argumentsInDoc.forEach(arg => {
      if (arg.created_by) participantEmails.add(arg.created_by);
    });
    
    // מגיבים (על הצעות, סעיפים, ומסמך)
    const sectionIds = sections.map(s => s.id);
    const relevantComments = allComments.filter(c => 
      (c.rootEntityType === 'suggestion' && suggestionIds.includes(c.rootEntityId)) ||
      (c.rootEntityType === 'section' && sectionIds.includes(c.rootEntityId)) ||
      (c.rootEntityType === 'document' && c.rootEntityId === document.id)
    );
    relevantComments.forEach(c => {
      if (c.created_by) participantEmails.add(c.created_by);
    });
    
    // עורכי סעיפים
    sections.forEach(s => {
      if (s.created_by) participantEmails.add(s.created_by);
    });

    // מסירים את יוצר ההצעה הנוכחית
    participantEmails.delete(currentUser.email);

    if (participantEmails.size === 0) return;

    // המרה למזהי משתמשים
    const emailToUser = {};
    users.forEach(u => { emailToUser[u.email] = u; });
    
    const notifications = [];
    const actionUrl = createPageUrl("SuggestionDetail") + `?id=${suggestion.id}`;
    const suggestionTypeText = suggestion.type === 'new_section' ? 'הצעה לסעיף חדש' : 'הצעת עריכה';

    for (const email of participantEmails) {
      const user = emailToUser[email];
      if (!user) continue;
      
      const userLang = user.preferredLanguage || 'he';
      notifications.push({
        userId: user.id,
        type: 'new_suggestion',
        title: translate('notifNewSuggestionTitle', userLang),
        message: `${currentUser.full_name} פרסם/ה ${suggestionTypeText} במסמך "${document.title}"`,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl
      });
    }

    if (notifications.length > 0) {
      await batchCreateNotifications(notifications);
    }
  } catch (error) {
    console.error('[NOTIFICATION ERROR] notifyNewSuggestion:', error);
  }
}

/**
 * יצירת התראה על תגובה חדשה - ליוצר ההצעה ולכל המגיבים
 */
export async function notifyNewComment({ comment, targetEntity, targetEntityType, parentComment = null }) {
  try {
    // Validate required data
    if (!comment?.id || !comment?.created_by || !targetEntity?.id || !targetEntityType) {
      console.error('[NOTIFICATION ERROR] Missing required data for comment notification:', { comment, targetEntity, targetEntityType });
      return;
    }
    
    const [users, publicProfiles, allComments] = await Promise.all([
      getCachedUsers(),
      getCachedPublicProfiles(),
      base44.entities.Comment.filter({ rootEntityType: targetEntityType, rootEntityId: targetEntity.id })
    ]);
    
    const commenter = getUserFromCache(users, publicProfiles, { email: comment.created_by });
    const commenterName = commenter?.full_name || commenter?.email?.split('@')[0] || 'משתמש';
    
    const notifiedEmails = new Set();
    notifiedEmails.add(comment.created_by);
    const notifications = [];
    
    let actionUrl;
    if (targetEntityType === 'suggestion') {
      actionUrl = createPageUrl("SuggestionDetail") + `?id=${targetEntity.id}&commentId=${comment.id}`;
    } else if (targetEntityType === 'section') {
      actionUrl = createPageUrl("SectionHistory") + `?id=${targetEntity.id}&commentId=${comment.id}`;
    }
    
    // 1. יוצר ההצעה/סעיף
    let ownerEmail = targetEntityType === 'suggestion' ? targetEntity.created_by : null;
    let owner = ownerEmail ? getUserFromCache(users, publicProfiles, { email: ownerEmail }) : null;
    if (targetEntityType === 'section' && targetEntity.lastEditedBy) {
      owner = getUserFromCache(users, publicProfiles, { id: targetEntity.lastEditedBy });
      ownerEmail = owner?.email;
    }
    
    if (owner && ownerEmail && !notifiedEmails.has(ownerEmail)) {
      notifiedEmails.add(ownerEmail);
      const userLang = owner.preferredLanguage || 'he';
      const messageKey = targetEntityType === 'suggestion' ? 'notifCommentMessageSuggestion' : 'notifCommentMessageSection';
      notifications.push({
        userId: owner.id,
        type: targetEntityType === 'suggestion' ? 'suggestion_comment' : 'section_comment',
        title: translate('notifCommentTitle', userLang),
        message: translate(messageKey, userLang, { name: commenterName }),
        relatedEntityId: targetEntity.id,
        relatedEntityType: targetEntityType,
        actionUrl
      });
    }
    
    // 2. כל המגיבים הקודמים (לא כולל התגובה החדשה)
    const commentersEmails = [...new Set(allComments
      .filter(c => c.id !== comment.id) // לא כולל את התגובה החדשה
      .map(c => c.created_by)
    )];
    
    for (const email of commentersEmails) {
      if (notifiedEmails.has(email)) continue;
      notifiedEmails.add(email);
      const user = getUserFromCache(users, publicProfiles, { email });
      if (!user) continue;
      const userLang = user.preferredLanguage || 'he';
      notifications.push({
        userId: user.id,
        type: targetEntityType === 'suggestion' ? 'suggestion_comment' : 'section_comment',
        title: translate('notifCommentTitle', userLang),
        message: translate('notifCommentOnDiscussion', userLang, { name: commenterName }),
        relatedEntityId: targetEntity.id,
        relatedEntityType: targetEntityType,
        actionUrl
      });
    }
    
    await batchCreateNotifications(notifications);
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}

/**
 * יצירת התראה על תגובה חדשה בדיון כללי של מסמך
 */
export async function notifyNewDocumentComment({ comment, document, parentComment = null }) {
  try {
    // Validate required data
    if (!comment?.id || !comment?.created_by || !document?.id) {
      console.error('[NOTIFICATION ERROR] Missing required data for document comment notification:', { comment, document });
      return;
    }
    
    const [users, publicProfiles, adminIds, allDocumentComments] = await Promise.all([
      getCachedUsers(),
      getCachedPublicProfiles(),
      getDocumentAdmins(document.id),
      base44.entities.Comment.filter({ rootEntityType: 'document', rootEntityId: document.id })
    ]);
    
    const commenter = getUserFromCache(users, publicProfiles, { email: comment.created_by });
    const commenterName = commenter?.full_name || commenter?.email?.split('@')[0] || 'משתמש';
    
    const notifiedEmails = new Set();
    notifiedEmails.add(comment.created_by);
    const notifications = [];
    const actionUrl = createPageUrl("DocumentView") + `?id=${document.id}`;
    
    // תשובה לתגובה
    if (parentComment && comment.created_by !== parentComment.created_by) {
      const parentCommenter = getUserFromCache(users, publicProfiles, { email: parentComment.created_by });
      if (parentCommenter) {
        notifiedEmails.add(parentComment.created_by);
        const userLang = parentCommenter.preferredLanguage || 'he';
        notifications.push({
          userId: parentCommenter.id,
          type: 'comment_reply',
          title: translate('notifReplyTitle', userLang),
          message: translate('notifReplyMessage', userLang, { name: commenterName }),
          relatedEntityId: document.id,
          relatedEntityType: 'document',
          actionUrl
        });
      }
    }
    
    // יוצר המסמך
    if (document.created_by && !notifiedEmails.has(document.created_by)) {
      const creator = getUserFromCache(users, publicProfiles, { email: document.created_by });
      if (creator) {
        notifiedEmails.add(document.created_by);
        const userLang = creator.preferredLanguage || 'he';
        notifications.push({
          userId: creator.id,
          type: 'document_comment',
          title: translate('notifDocumentCommentTitle', userLang),
          message: translate('notifDocumentCommentMessage', userLang, { name: commenterName, title: document.title }),
          relatedEntityId: document.id,
          relatedEntityType: 'document',
          actionUrl
        });
      }
    }
    
    // מנהלים
    for (const adminId of adminIds) {
      const admin = getUserFromCache(users, publicProfiles, { id: adminId });
      if (!admin || notifiedEmails.has(admin.email)) continue;
      notifiedEmails.add(admin.email);
      const userLang = admin.preferredLanguage || 'he';
      notifications.push({
        userId: adminId,
        type: 'document_comment',
        title: translate('notifDocumentCommentTitle', userLang),
        message: translate('notifDocumentCommentMessage', userLang, { name: commenterName, title: document.title }),
        relatedEntityId: document.id,
        relatedEntityType: 'document',
        actionUrl
      });
    }
    
    // משתתפי הדיון
    const commentersEmails = [...new Set(allDocumentComments.map(c => c.created_by))];
    for (const email of commentersEmails) {
      if (notifiedEmails.has(email)) continue;
      notifiedEmails.add(email);
      const user = getUserFromCache(users, publicProfiles, { email });
      if (!user) continue;
      const userLang = user.preferredLanguage || 'he';
      notifications.push({
        userId: user.id,
        type: 'document_comment',
        title: translate('notifDocumentCommentTitle', userLang),
        message: translate('notifDocumentCommentMessage', userLang, { name: commenterName, title: document.title }),
        relatedEntityId: document.id,
        relatedEntityType: 'document',
        actionUrl
      });
    }
    
    await batchCreateNotifications(notifications);
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}