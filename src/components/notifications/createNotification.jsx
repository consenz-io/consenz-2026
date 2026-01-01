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
async function getDocumentCreator(documentId, users, publicProfiles, docList = null) {
  try {
    let docs = docList;
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
  if (!notifications || notifications.length === 0) {
    console.log('[BATCH NOTIFICATIONS] No notifications to create');
    return;
  }
  
  console.log('[BATCH NOTIFICATIONS] Creating', notifications.length, 'notifications...');
  
  try {
    // Create all notifications in parallel
    const results = await Promise.all(notifications.map((n, index) => 
      base44.entities.Notification.create({ ...n, read: false })
        .then(result => {
          console.log('[BATCH NOTIFICATIONS] Successfully created notification', index + 1, '/', notifications.length);
          return result;
        })
        .catch(err => {
          console.error('[BATCH NOTIFICATIONS] Failed to create notification', index + 1, ':', err);
          console.error('[BATCH NOTIFICATIONS] Failed notification data:', JSON.stringify(n, null, 2));
          return null;
        })
    ));
    
    const successful = results.filter(r => r !== null).length;
    const failed = results.length - successful;
    
    console.log('[BATCH NOTIFICATIONS] Batch complete: Success:', successful, 'Failed:', failed);
    
    if (failed > 0) {
      console.error('[BATCH NOTIFICATIONS] WARNING:', failed, 'notifications failed to create');
    }
  } catch (error) {
    console.error('[BATCH NOTIFICATIONS] CRITICAL: Batch create failed completely:', error);
    console.error('[BATCH NOTIFICATIONS] Stack:', error.stack);
  }
}

/**
 * יצירת התראה למשתמש + הוספה ל-EmailDigest במקביל
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  relatedEntityId,
  relatedEntityType,
  actionUrl,
  documentId = null,
  documentTitle = null
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
    
    // Create notification - don't wait for it
    const notificationPromise = base44.entities.Notification.create({
      userId,
      type,
      title,
      message,
      relatedEntityId,
      relatedEntityType,
      actionUrl: validActionUrl,
      read: false
    });
    
    // Add to email digest in parallel - don't wait for it
    const { addToEmailDigest } = await import('./addToEmailDigest');
    const digestPromise = addToEmailDigest({
      userId,
      notificationType: type,
      title,
      message,
      actionUrl: validActionUrl,
      relatedEntityType,
      relatedEntityId,
      documentId,
      documentTitle
    });
    
    // Wait for both to complete
    const [notification] = await Promise.all([notificationPromise, digestPromise]);
    
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
export async function notifyVoteOnSuggestion({ suggestion, voterEmail, voterName, currentUser = null }) {
  try {
    // Don't notify if voter is the suggestion creator
    if (voterEmail === suggestion.created_by) return;
    
    // Validate required data
    if (!suggestion?.id || !suggestion?.created_by || !voterEmail) {
      console.error('[NOTIFICATION ERROR] Missing required data for vote notification:', { suggestion, voterEmail });
      return;
    }
    
    // Ensure voter has public profile
    if (currentUser) {
      await ensureUserPublicProfileForInteraction(currentUser);
    }
    
    // Fetch suggestion creator directly
    const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
    const suggestionCreator = suggestionCreatorList[0];
    if (!suggestionCreator?.id) {
      console.error('[NOTIFICATION ERROR] Suggestion creator not found:', suggestion.created_by);
      return;
    }
    
    // Get voter name if not provided
    let displayName = voterName;
    if (!displayName && voterEmail) {
      const voterList = await base44.entities.User.filter({ email: voterEmail });
      displayName = voterList[0]?.full_name || voterEmail.split('@')[0];
    }
    
    const userLang = suggestionCreator.preferredLanguage || 'he';
    
    // Fetch document for context
    const docs = await base44.entities.Document.filter({ id: suggestion.documentId });
    const doc = docs[0];
    
    await createNotification({
      userId: suggestionCreator.id,
      type: 'vote_on_suggestion',
      title: translate('notifVoteTitle', userLang),
      message: translate('notifVoteMessage', userLang, { name: displayName, title: suggestion.title || 'הצעה' }),
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: createPageUrl("SuggestionDetail") + `?id=${suggestion.id}`,
      documentId: suggestion.documentId,
      documentTitle: doc?.title
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
      
      // Fetch document for context
      const docs = await base44.entities.Document.filter({ id: suggestion.documentId });
      const doc = docs[0];
      
      notifications.push({
        userId: suggestionCreator.id,
        type: newStatus === 'accepted' ? 'suggestion_accepted' : 'suggestion_rejected',
        title: translate(statusKey.titleKey, userLang),
        message: translate(statusKey.messageKey, userLang, { title: suggestionTitle }),
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl,
        documentId: suggestion.documentId,
        documentTitle: doc?.title
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
        const docs = await base44.entities.Document.filter({ id: suggestion.documentId });
        const doc = docs[0];
        notifications.push({
          userId: docCreator.id,
          type: 'suggestion_accepted',
          title: translate('notifAcceptedTitle', userLang),
          message: translate('notifAcceptedMessage', userLang, { title: suggestionTitle }),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl,
          documentId: suggestion.documentId,
          documentTitle: doc?.title
        });
      }
      
      const docs = await base44.entities.Document.filter({ id: suggestion.documentId });
      const doc = docs[0];
      
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
          actionUrl,
          documentId: suggestion.documentId,
          documentTitle: doc?.title
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
          actionUrl,
          documentId: suggestion.documentId,
          documentTitle: doc?.title
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
    throw error;
  }
}

/**
 * יצירת התראה על הצעה חדשה במסמך - לכל העוקבים אחרי המסמך
 * ✅ FIXED: Uses DocumentFollow entity for notifications
 * ✅ FIXED: Auto-follows users on first interaction
 */
export async function notifyNewSuggestion({ suggestion, document: doc, currentUser }) {
  try {
    // Validate required data
    if (!suggestion?.id) {
      console.error('[NOTIFICATION ERROR] Missing suggestion.id');
      return;
    }
    if (!doc?.id) {
      console.error('[NOTIFICATION ERROR] Missing document.id');
      return;
    }
    if (!currentUser?.email) {
      console.error('[NOTIFICATION ERROR] Missing currentUser.email');
      return;
    }
    if (!suggestion.type) {
      console.error('[NOTIFICATION ERROR] Missing suggestion.type');
      return;
    }
    
    // Fix missing full_name
    if (!currentUser?.full_name) {
      console.warn('[NOTIFICATION WARNING] Missing currentUser.full_name, using email fallback');
      currentUser = { 
        ...currentUser, 
        full_name: currentUser.email.split('@')[0] || 'User'
      };
    }
    
    console.log('[NOTIFY NEW SUGGESTION] ===== STARTING NOTIFICATION PROCESS =====');
    console.log('[NOTIFY NEW SUGGESTION] Suggestion ID:', suggestion.id);
    console.log('[NOTIFY NEW SUGGESTION] Suggestion Type:', suggestion.type);
    console.log('[NOTIFY NEW SUGGESTION] Document ID:', doc.id);
    console.log('[NOTIFY NEW SUGGESTION] Document Title:', doc.title);
    console.log('[NOTIFY NEW SUGGESTION] Current User:', currentUser.email, '/', currentUser.full_name);
    
    // ===== FIXED: Removed getCachedUsers() from initial fetch =====
    console.log('[NOTIFY NEW SUGGESTION] Fetching data from database...');
    const [publicProfiles, allSuggestions, allArguments, sections, adminIds] = await Promise.all([
      getCachedPublicProfiles(),
      base44.entities.Suggestion.filter({ documentId: doc.id }),
      base44.entities.Argument.list(),
      base44.entities.Section.filter({ documentId: doc.id }),
      getDocumentAdmins(doc.id)
    ]);
    
    console.log('[NOTIFY NEW SUGGESTION] Data fetched successfully:');
    console.log('[NOTIFY NEW SUGGESTION] - Public Profiles:', publicProfiles.length);
    console.log('[NOTIFY NEW SUGGESTION] - Suggestions in document:', allSuggestions.length);
    console.log('[NOTIFY NEW SUGGESTION] - Arguments (all):', allArguments.length);
    console.log('[NOTIFY NEW SUGGESTION] - Sections:', sections.length);
    console.log('[NOTIFY NEW SUGGESTION] - Admin IDs:', adminIds.length);
    
    // Build suggestion IDs list
    const suggestionIds = allSuggestions.map(s => s.id);
    if (!suggestionIds.includes(suggestion.id)) {
      suggestionIds.push(suggestion.id);
    }

    // Fetch votes and comments
    console.log('[NOTIFY NEW SUGGESTION] Fetching votes and comments...');
    const [allVotes, allComments] = await Promise.all([
      base44.entities.Vote.list(),
      base44.entities.Comment.list()
    ]);
    
    console.log('[NOTIFY NEW SUGGESTION] - Total votes:', allVotes.length);
    console.log('[NOTIFY NEW SUGGESTION] - Total comments:', allComments.length);

    // ===== Auto-follow current user if this is their first interaction =====
    console.log('[NOTIFY NEW SUGGESTION] ===== AUTO-FOLLOW CHECK =====');
    try {
      const existingFollow = await base44.entities.DocumentFollow.filter({
        documentId: doc.id,
        userId: currentUser.id
      });
      
      if (existingFollow.length === 0) {
        console.log('[NOTIFY NEW SUGGESTION] Creating auto-follow for user:', currentUser.email);
        await base44.entities.DocumentFollow.create({
          documentId: doc.id,
          userId: currentUser.id,
          followedAt: new Date().toISOString()
        });
        console.log('[NOTIFY NEW SUGGESTION] Auto-follow created successfully');
      } else {
        console.log('[NOTIFY NEW SUGGESTION] User already following document');
      }
    } catch (followError) {
      console.error('[NOTIFY NEW SUGGESTION] Error with auto-follow:', followError);
      // Don't throw - this shouldn't block notifications
    }
    
    // ===== Get followers of the document =====
    console.log('[NOTIFY NEW SUGGESTION] ===== FETCHING DOCUMENT FOLLOWERS =====');
    const followers = await base44.entities.DocumentFollow.filter({ documentId: doc.id });
    console.log('[NOTIFY NEW SUGGESTION] Found', followers.length, 'followers');
    console.log('[NOTIFY NEW SUGGESTION] Current user ID:', currentUser.id);
    console.log('[NOTIFY NEW SUGGESTION] All follower user IDs:', followers.map(f => f.userId));
    
    const followerUserIds = followers.map(f => f.userId).filter(id => {
      const shouldInclude = id !== currentUser.id;
      if (!shouldInclude) {
        console.log('[NOTIFY NEW SUGGESTION] Excluding current user from followers:', id);
      }
      return shouldInclude;
    });
    console.log('[NOTIFY NEW SUGGESTION] Follower user IDs (excluding current user):', followerUserIds.length, followerUserIds);
    
    if (followerUserIds.length === 0) {
      console.log('[NOTIFY NEW SUGGESTION] ===== NO FOLLOWERS TO NOTIFY =====');
      return;
    }
    
    // ===== Fetch follower user data =====
    console.log('[NOTIFY NEW SUGGESTION] ===== FETCHING FOLLOWER USER DATA =====');
    const users = await base44.entities.User.filter({ 
      id: { $in: followerUserIds } 
    });
    
    console.log('[NOTIFY NEW SUGGESTION] Fetched', users.length, 'follower users');
    
    // ===== Build notifications =====
    console.log('[NOTIFY NEW SUGGESTION] ===== BUILDING NOTIFICATIONS =====');
    const notifications = [];
    const actionUrl = createPageUrl("SuggestionDetail") + `?id=${suggestion.id}`;
    console.log('[NOTIFY NEW SUGGESTION] Action URL:', actionUrl);
    
    const suggestionTypeText = suggestion.type === 'new_section' 
      ? 'הצעה לסעיף חדש' 
      : suggestion.type === 'edit_section'
      ? 'הצעת עריכה לסעיף'
      : 'הצעת עריכה לכותרת נושא';

    let successfulNotifications = 0;
    let failedNotifications = 0;
    
    for (const user of users) {
      if (!user.id) {
        console.error('[NOTIFY NEW SUGGESTION] ERROR: User has no ID:', user.email);
        failedNotifications++;
        continue;
      }
      
      const userLang = user.preferredLanguage || 'he';
      const notifTitle = translate('notifNewSuggestionTitle', userLang);
      const notifMessage = `${currentUser.full_name} פרסם/ה ${suggestionTypeText} במסמך "${doc.title}"`;
      
      notifications.push({
        userId: user.id,
        type: 'new_suggestion_in_followed_document',
        title: notifTitle,
        message: notifMessage,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl,
        documentId: doc.id,
        documentTitle: doc.title
      });
      successfulNotifications++;
      
      console.log('[NOTIFY NEW SUGGESTION] Created notification for:', user.email, '/', user.full_name || user.email);
    }

    console.log('[NOTIFY NEW SUGGESTION] ===== NOTIFICATION SUMMARY =====');
    console.log('[NOTIFY NEW SUGGESTION] Successfully prepared:', successfulNotifications);
    console.log('[NOTIFY NEW SUGGESTION] Failed to prepare:', failedNotifications);
    console.log('[NOTIFY NEW SUGGESTION] Total notifications to send:', notifications.length);
    
    if (notifications.length > 0) {
      console.log('[NOTIFY NEW SUGGESTION] Sending notifications to database...');
      await batchCreateNotifications(notifications);
      console.log('[NOTIFY NEW SUGGESTION] ===== NOTIFICATIONS SENT SUCCESSFULLY =====');
    } else {
      console.error('[NOTIFY NEW SUGGESTION] ===== ERROR: NO NOTIFICATIONS TO SEND =====');
    }
  } catch (error) {
    console.error('[NOTIFICATION ERROR] ===== CRITICAL ERROR IN notifyNewSuggestion =====');
    console.error('[NOTIFICATION ERROR] Error:', error);
    console.error('[NOTIFICATION ERROR] Error message:', error.message);
    console.error('[NOTIFICATION ERROR] Stack trace:', error.stack);
    console.error('[NOTIFICATION ERROR] Suggestion ID:', suggestion?.id);
    console.error('[NOTIFICATION ERROR] Document ID:', doc?.id);
    console.error('[NOTIFICATION ERROR] Current user:', currentUser?.email);
    throw error;
  }
}

/**
 * יצירת התראה על תגובה חדשה - ליוצר ההצעה ולכל המגיבים
 */
export async function notifyNewComment({ comment, targetEntity, targetEntityType, parentComment = null, currentUser = null }) {
  try {
    // Validate required data
    if (!comment?.id || !comment?.created_by || !targetEntity?.id || !targetEntityType) {
      console.error('[NOTIFICATION ERROR] Missing required data for comment notification:', { comment, targetEntity, targetEntityType });
      return;
    }
    
    // Ensure commenter has public profile
    if (currentUser) {
      await ensureUserPublicProfileForInteraction(currentUser);
    }
    
    const [publicProfiles, allComments] = await Promise.all([
      getCachedPublicProfiles(),
      base44.entities.Comment.filter({ rootEntityType: targetEntityType, rootEntityId: targetEntity.id })
    ]);
    
    const notifiedEmails = new Set();
    notifiedEmails.add(comment.created_by);
    const notifications = [];
    
    // ===== Collect all emails that need notifications =====
    
    let actionUrl;
    if (targetEntityType === 'suggestion') {
      actionUrl = createPageUrl("SuggestionDetail") + `?id=${targetEntity.id}&commentId=${comment.id}`;
    } else if (targetEntityType === 'section') {
      actionUrl = createPageUrl("SectionHistory") + `?id=${targetEntity.id}&commentId=${comment.id}`;
    }
    
    // 1. יוצר ההצעה/סעיף
    let ownerEmail = targetEntityType === 'suggestion' ? targetEntity.created_by : null;
    if (targetEntityType === 'section' && targetEntity.lastEditedBy) {
      // Need to fetch user by ID to get email
      const ownerUsers = await base44.entities.User.filter({ id: targetEntity.lastEditedBy });
      if (ownerUsers.length > 0) {
        ownerEmail = ownerUsers[0].email;
      }
    }
    
    if (ownerEmail && !notifiedEmails.has(ownerEmail)) {
      notifiedEmails.add(ownerEmail);
    }
    
    // 2. כל המגיבים הקודמים
    const commentersEmails = [...new Set(allComments
      .filter(c => c.id !== comment.id && c.created_by)
      .map(c => c.created_by)
    )];
    
    commentersEmails.forEach(email => {
      if (!notifiedEmails.has(email)) {
        notifiedEmails.add(email);
      }
    });
    
    // ===== Fetch all users who need notifications =====
    const emailsArray = Array.from(notifiedEmails).filter(e => e !== comment.created_by);
    if (emailsArray.length === 0) return;
    
    const users = await base44.entities.User.filter({ email: { $in: emailsArray } });
    
    // Get commenter for name
    const commenterUsers = await base44.entities.User.filter({ email: comment.created_by });
    const commenter = commenterUsers[0] || { email: comment.created_by, full_name: comment.created_by.split('@')[0] };
    const commenterName = commenter.full_name || commenter.email?.split('@')[0] || 'משתמש';
    
    // ===== Build notifications =====
    const emailToUser = {};
    users.forEach(u => {
      if (u.email && u.id) {
        emailToUser[u.email] = u;
      }
    });
    
    // Owner notification
    if (ownerEmail && emailToUser[ownerEmail]) {
      const owner = emailToUser[ownerEmail];
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
    
    // Previous commenters notifications
    commentersEmails.forEach(email => {
      if (email !== ownerEmail && emailToUser[email]) {
        const user = emailToUser[email];
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
    });
    
    if (notifications.length > 0) {
      await batchCreateNotifications(notifications);
    }
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}

/**
 * יצירת התראה על תגובה חדשה בדיון כללי של מסמך
 */
export async function notifyNewDocumentComment({ comment, document: doc, parentComment = null, currentUser = null }) {
  try {
    // Validate required data
    if (!comment?.id || !comment?.created_by || !doc?.id) {
      console.error('[NOTIFICATION ERROR] Missing required data for document comment notification:', { comment, doc });
      return;
    }
    
    // Ensure commenter has public profile
    if (currentUser) {
      await ensureUserPublicProfileForInteraction(currentUser);
    }
    
    const [publicProfiles, adminIds, allDocumentComments] = await Promise.all([
      getCachedPublicProfiles(),
      getDocumentAdmins(doc.id),
      base44.entities.Comment.filter({ rootEntityType: 'document', rootEntityId: doc.id })
    ]);
    
    const notifiedEmails = new Set();
    notifiedEmails.add(comment.created_by);
    const notifications = [];
    const actionUrl = createPageUrl("DocumentView") + `?id=${doc.id}`;
    
    // ===== Collect all emails that need notifications =====
    
    // Parent comment author
    if (parentComment && comment.created_by !== parentComment.created_by && parentComment.created_by) {
      notifiedEmails.add(parentComment.created_by);
    }
    
    // Document creator
    if (doc.created_by && !notifiedEmails.has(doc.created_by)) {
      notifiedEmails.add(doc.created_by);
    }
    
    // Admin emails
    if (adminIds.length > 0) {
      const adminUsers = await base44.entities.User.filter({ id: { $in: adminIds } });
      adminUsers.forEach(admin => {
        if (admin.email && !notifiedEmails.has(admin.email)) {
          notifiedEmails.add(admin.email);
        }
      });
    }
    
    // Discussion participants
    const commentersEmails = [...new Set(allDocumentComments
      .filter(c => c.created_by)
      .map(c => c.created_by))];
    commentersEmails.forEach(email => {
      if (!notifiedEmails.has(email)) {
        notifiedEmails.add(email);
      }
    });
    
    // ===== Fetch all users who need notifications =====
    const emailsArray = Array.from(notifiedEmails).filter(e => e !== comment.created_by);
    if (emailsArray.length === 0) return;
    
    const users = await base44.entities.User.filter({ email: { $in: emailsArray } });
    
    // Get commenter for name
    const commenterUsers = await base44.entities.User.filter({ email: comment.created_by });
    const commenter = commenterUsers[0] || { email: comment.created_by, full_name: comment.created_by.split('@')[0] };
    const commenterName = commenter.full_name || commenter.email?.split('@')[0] || 'משתמש';
    
    // ===== Build notifications =====
    const emailToUser = {};
    users.forEach(u => {
      if (u.email && u.id) {
        emailToUser[u.email] = u;
      }
    });
    
    // Parent commenter notification (reply)
    if (parentComment && parentComment.created_by && parentComment.created_by !== comment.created_by) {
      const parentCommenter = emailToUser[parentComment.created_by];
      if (parentCommenter) {
        const userLang = parentCommenter.preferredLanguage || 'he';
        notifications.push({
          userId: parentCommenter.id,
          type: 'comment_reply',
          title: translate('notifReplyTitle', userLang),
          message: translate('notifReplyMessage', userLang, { name: commenterName }),
          relatedEntityId: doc.id,
          relatedEntityType: 'document',
          actionUrl
        });
      }
    }
    
    // Document creator notification
    if (doc.created_by && emailToUser[doc.created_by] && doc.created_by !== comment.created_by) {
      const creator = emailToUser[doc.created_by];
      const userLang = creator.preferredLanguage || 'he';
      notifications.push({
        userId: creator.id,
        type: 'document_comment',
        title: translate('notifDocumentCommentTitle', userLang),
        message: translate('notifDocumentCommentMessage', userLang, { name: commenterName, title: doc.title }),
        relatedEntityId: doc.id,
        relatedEntityType: 'document',
        actionUrl
      });
    }
    
    // Admins and other participants notifications
    emailsArray.forEach(email => {
      // Skip if already notified as parent commenter or doc creator
      if (email === parentComment?.created_by || email === doc.created_by) return;
      
      const user = emailToUser[email];
      if (!user) return;
      
      const userLang = user.preferredLanguage || 'he';
      notifications.push({
        userId: user.id,
        type: 'document_comment',
        title: translate('notifDocumentCommentTitle', userLang),
        message: translate('notifDocumentCommentMessage', userLang, { name: commenterName, title: doc.title }),
        relatedEntityId: doc.id,
        relatedEntityType: 'document',
        actionUrl
      });
    });
    
    if (notifications.length > 0) {
      await batchCreateNotifications(notifications);
    }
  } catch (error) {
    console.error('[NOTIFICATION ERROR]', error);
  }
}