import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { PAGE_NAMES } from "@/components/pageNames";
import { showBrowserNotification } from './browserNotifications';
import { validateActionUrl, sendNotificationsBatch, deduplicateNotifications, sanitizeMessage } from './notificationHelpers';
import { notificationQueue } from './notificationQueue';

// Helper function - stub for now, user interaction profile is already handled in CommentsSection
async function ensureUserPublicProfileForInteraction(user) {
  // This is handled by CommentsSection, so we don't need to do anything here
  return;
}

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
      notifExpiredTitle: "Suggestion voting period ended",
      notifExpiredMessage: "The voting period for suggestion \"{title}\" has ended",
      notifNewSuggestionTitle: "New suggestion in document",
      notifNewSuggestionMessage: "{name} added a new suggestion in the document \"{title}\"",
      notifNewEditSuggestionTitle: "Suggestion to edit a suggestion",
      notifNewEditSuggestionMessage: "{name} suggested an edit to a suggestion in document \"{title}\"",
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
      notifExpiredTitle: "תקופת ההצבעה הסתיימה",
      notifExpiredMessage: "תקופת ההצבעה על ההצעה \"{title}\" הסתיימה",
      notifNewSuggestionTitle: "הצעה חדשה במסמך",
      notifNewSuggestionMessage: "{name} הוסיף הצעה חדשה במסמך \"{title}\"",
      notifNewEditSuggestionTitle: "הצעה לעריכת הצעה",
      notifNewEditSuggestionMessage: "{name} הציע/ה עריכה להצעה במסמך \"{title}\"",
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
      notifExpiredTitle: "انتهت فترة التصويت",
      notifExpiredMessage: "انتهت فترة التصويت على الاقتراح \"{title}\"",
      notifNewSuggestionTitle: "اقتراح جديد في المستند",
      notifNewSuggestionMessage: "{name} أضاف اقتراحًا جديدًا في المستמך \"{title}\"",
      notifNewEditSuggestionTitle: "اقتراح لتعديل اقتراح",
      notifNewEditSuggestionMessage: "{name} اقترح تعديلاً على اقتراح في المستند \"{title}\"",
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

/**
 * Batch create notifications - now using backend function for async processing
 */
async function batchCreateNotifications(notifications) {
  if (!notifications || notifications.length === 0) {
    console.log('[BATCH NOTIFICATIONS] No notifications to create');
    return { successful: 0, failed: 0 };
  }
  
  // Deduplicate before sending
  const uniqueNotifications = deduplicateNotifications(notifications);
  
  // Validate and sanitize all notifications
  const validatedNotifications = uniqueNotifications.map(notif => ({
    ...notif,
    actionUrl: validateActionUrl(notif.actionUrl),
    message: sanitizeMessage(notif.message, 150)
  }));
  
  console.log('[BATCH NOTIFICATIONS] Sending', validatedNotifications.length, 'notifications via backend...');
  
  // Send via backend function (async, non-blocking)
  return sendNotificationsBatch(validatedNotifications);
}

/**
 * Send notification email to user - queued to prevent rate limiting
 */
async function sendNotificationEmail({ userId, title, message, actionUrl }) {
  // Queue the email to avoid rate limiting
  notificationQueue.add(async () => {
    try {
      // Fetch user to get email
      const users = await base44.entities.User.filter({ id: userId });
      if (!users || users.length === 0) return;
      
      const user = users[0];
      if (!user.email) return;
      
      // Build email HTML
      const fullUrl = actionUrl?.startsWith('http') 
        ? actionUrl 
        : `${window.location.origin}${actionUrl}`;
      
      const emailHtml = `
        <!DOCTYPE html>
        <html dir="${user.preferredLanguage === 'he' || user.preferredLanguage === 'ar' ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .message { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .button:hover { background: #5568d3; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e9ecef; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Consenz</h1>
            </div>
            <div class="content">
              <h2>${title}</h2>
              <div class="message">
                ${message}
              </div>
              ${actionUrl ? `<a href="${fullUrl}" class="button">צפה במסמך</a>` : ''}
            </div>
            <div class="footer">
              <p>התראה זו נשלחה מפלטפורמת Consenz</p>
              <p>לניהול הגדרות התראות, היכנס לפרופיל שלך</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Send email using base44 integration
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: title,
        body: emailHtml
      });
      
      console.log('[EMAIL] ✓ Sent to:', user.email);
    } catch (error) {
      console.error('[EMAIL] Error sending:', error);
    }
  });
}

/**
 * Create single notification for user + add to EmailDigest + browser notification + email
 * Used for individual notifications (not batch)
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
    // Block all vote-related notifications
    if (type === 'vote_on_suggestion' || type === 'new_vote_on_suggestion') {
      console.log('[NOTIFICATION] Skipping vote notification');
      return null;
    }
    
    if (!userId) {
      console.warn('[NOTIFICATION] Missing userId, skipping');
      return null;
    }
    
    // Validate and sanitize actionUrl
    const validActionUrl = validateActionUrl(actionUrl);
    
    if (!validActionUrl) {
      console.warn('[NOTIFICATION] Invalid actionUrl for type:', type);
    }
    
    // Sanitize message for browser notifications
    const sanitizedMessage = sanitizeMessage(message, 150);
    
    // Create notification in DB
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
    
    // Add to email digest (don't wait - run in background)
    const { addToEmailDigest } = await import('./addToEmailDigest');
    addToEmailDigest({
      userId,
      notificationType: type,
      title,
      message,
      actionUrl: validActionUrl,
      relatedEntityType,
      relatedEntityId,
      documentId,
      documentTitle
    }).catch(err => console.error('[EMAIL DIGEST] Error:', err));
    
    // Send immediate email notification (fire-and-forget)
    sendNotificationEmail({
      userId,
      title,
      message,
      actionUrl: validActionUrl
    }).catch(err => console.error('[EMAIL] Error:', err));
    
    // Show browser notification (if page is not focused)
    showBrowserNotification({
      title,
      body: sanitizedMessage,
      actionUrl: validActionUrl
    });
    
    return notification;
  } catch (error) {
    console.error('[NOTIFICATION] Create failed:', error?.message || error);
    return null;
  }
}

/**
 * Create notification for new vote on suggestion
 * DISABLED - No vote notifications
 */
export async function notifyVoteOnSuggestion({ suggestion, voterEmail, voterName, currentUser = null }) {
  // Vote notifications are disabled
  return;
}

/**
 * Create notification for suggestion status change
 */
export async function notifySuggestionStatusChange({ suggestion, newStatus }) {
  console.log('[NOTIFY STATUS] ===== START =====');
  console.log('[NOTIFY STATUS] Suggestion:', suggestion.id, 'Status:', newStatus);
  
  try {
    if (!suggestion?.id || !suggestion?.created_by) {
      console.error('[NOTIFY STATUS] ✗ Missing data:', { id: suggestion?.id, created_by: suggestion?.created_by });
      return;
    }
    
    const statusKeys = {
      accepted: { titleKey: 'notifAcceptedTitle', messageKey: 'notifAcceptedMessage' },
      rejected: { titleKey: 'notifRejectedTitle', messageKey: 'notifRejectedMessage' },
      expired: { titleKey: 'notifExpiredTitle', messageKey: 'notifExpiredMessage' }
    };
    
    if (!statusKeys[newStatus]) {
      console.error('[NOTIFY STATUS] ✗ Invalid status:', newStatus);
      return;
    }
    
    const statusKey = statusKeys[newStatus];
    const notifiedUserIds = new Set();
    const notifications = [];
    const actionUrl = `${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${suggestion.id}`;
    
    // Fetch document for context
    const docs = await base44.entities.Document.filter({ id: suggestion.documentId });
    const doc = docs[0];
    
    // 1. Fetch suggestion creator
    console.log('[NOTIFY STATUS] Fetching creator:', suggestion.created_by);
    const creatorList = await base44.entities.User.filter({ email: suggestion.created_by });
    
    if (!creatorList || creatorList.length === 0) {
      console.error('[NOTIFY STATUS] ✗ Creator not found');
      return;
    }
    
    const creator = creatorList[0];
    if (!creator.id) {
      console.error('[NOTIFY STATUS] ✗ Creator has no ID');
      return;
    }
    
    notifiedUserIds.add(creator.id);
    const userLang = creator.preferredLanguage || 'he';
    
    notifications.push({
      userId: creator.id,
      type: newStatus === 'accepted' ? 'suggestion_accepted' : newStatus === 'rejected' ? 'suggestion_rejected' : 'suggestion_expiring',
      title: translate(statusKey.titleKey, userLang),
      message: translate(statusKey.messageKey, userLang, { title: suggestion.title || 'הצעה' }),
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl,
      documentId: suggestion.documentId,
      documentTitle: doc?.title
    });
    console.log('[NOTIFY STATUS] ✓ Added creator notification');
  
    
    // 2. If accepted - notify all document participants
    if (newStatus === 'accepted') {
      console.log('[NOTIFY STATUS] Fetching document participants...');
      const [userInteractions, publicProfiles] = await Promise.all([
        base44.entities.UserInteraction.filter({ documentId: suggestion.documentId }),
        getCachedPublicProfiles()
      ]);
      
      const participantUserIds = userInteractions.map(ui => ui.userId).filter(Boolean).filter(id => id !== creator.id);
      console.log('[NOTIFY STATUS] Found', participantUserIds.length, 'document participants');
      
      if (participantUserIds.length > 0) {
        const allUsers = await base44.entities.User.filter({ id: { $in: participantUserIds } });
        
        for (const user of allUsers) {
          if (notifiedUserIds.has(user.id)) continue;
          notifiedUserIds.add(user.id);
          const userLang = user.preferredLanguage || 'he';
          notifications.push({
            userId: user.id,
            type: 'suggestion_accepted',
            title: translate('notifAcceptedTitle', userLang),
            message: translate('notifAcceptedMessage', userLang, { title: suggestion.title || 'הצעה' }),
            relatedEntityId: suggestion.id,
            relatedEntityType: 'suggestion',
            actionUrl,
            documentId: suggestion.documentId,
            documentTitle: doc?.title
          });
        }
        console.log('[NOTIFY STATUS] ✓ Added', allUsers.length, 'participant notifications');
      }
    }
    
    // 3. If expired - notify voters and commenters
    if (newStatus === 'expired') {
      console.log('[NOTIFY STATUS] Fetching voters and commenters...');
      const [allVotes, allComments, publicProfiles] = await Promise.all([
        base44.entities.Vote.filter({ suggestionId: suggestion.id }),
        base44.entities.Comment.filter({ rootEntityType: 'suggestion', rootEntityId: suggestion.id }),
        getCachedPublicProfiles()
      ]);
      
      console.log('[NOTIFY STATUS] Votes:', allVotes.length, 'Comments:', allComments.length);
      
      // Collect voter user IDs
      const voterIds = allVotes.map(v => v.userId).filter(Boolean);
      
      // Collect commenter emails
      const commenterEmails = [...new Set(allComments.map(c => c.created_by).filter(Boolean))];
      
      // Fetch users
      const [voterUsers, commenterUsers] = await Promise.all([
        voterIds.length > 0 ? base44.entities.User.filter({ id: { $in: voterIds } }) : [],
        commenterEmails.length > 0 ? base44.entities.User.filter({ email: { $in: commenterEmails } }) : []
      ]);
      
      const allUsers = [...voterUsers, ...commenterUsers];
      
      // Deduplicate and notify
      for (const user of allUsers) {
        if (notifiedUserIds.has(user.id)) continue;
        notifiedUserIds.add(user.id);
        const userLang = user.preferredLanguage || 'he';
        notifications.push({
          userId: user.id,
          type: 'suggestion_expiring',
          title: translate('notifExpiredTitle', userLang),
          message: translate('notifExpiredMessage', userLang, { title: suggestion.title || 'הצעה' }),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl,
          documentId: suggestion.documentId,
          documentTitle: doc?.title
        });
      }
      console.log('[NOTIFY STATUS] ✓ Added', allUsers.length, 'expired notifications');
    }
    
    console.log('[NOTIFY STATUS] Total to send:', notifications.length);
    
    if (notifications.length > 0) {
      const { successful, failed } = await batchCreateNotifications(notifications);
      console.log(`[NOTIFY STATUS] ✓ Complete: ${successful} sent, ${failed} failed`);
    }
    
    console.log('[NOTIFY STATUS] ===== END =====');
  } catch (error) {
    console.error('[NOTIFY STATUS] ✗ CRITICAL ERROR:', error?.message || error);
    console.error('[NOTIFY STATUS] Stack:', error?.stack);
    throw error;
  }
}

/**
 * Create notification for new suggestion in document - for all document followers
 * ✅ FIXED: Uses DocumentFollow entity for notifications
 * ✅ FIXED: Auto-follows users on first interaction
 */
export async function notifyNewSuggestion({ suggestion, document: doc, currentUser }) {
  return _notifyNewSuggestion({ suggestion, document: doc, currentUser, relatedEntityType: 'suggestion' });
}

/**
 * Create notification for new topic title edit suggestion in document - for all document followers
 */
export async function notifyNewTopicEditSuggestion({ topicEditSuggestion, document: doc, currentUser }) {
  return _notifyNewSuggestion({ 
    suggestion: topicEditSuggestion, 
    document: doc, 
    currentUser, 
    relatedEntityType: 'topic_edit_suggestion',
    topicId: topicEditSuggestion.topicId
  });
}

// Shared helper function
async function _notifyNewSuggestion({ suggestion, document: doc, currentUser, relatedEntityType, topicId = null }) {
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
    console.log('[NOTIFY NEW SUGGESTION] Related Entity Type:', relatedEntityType);
    console.log('[NOTIFY NEW SUGGESTION] Topic ID:', topicId || 'N/A');
    console.log('[NOTIFY NEW SUGGESTION] Document ID:', doc.id);
    console.log('[NOTIFY NEW SUGGESTION] Document Title:', doc.title);
    console.log('[NOTIFY NEW SUGGESTION] Current User:', currentUser.email, '/', currentUser.full_name);
    
    // ===== Fetch data from database =====
    console.log('[NOTIFY NEW SUGGESTION] Fetching data from database...');
    const [publicProfiles, allSuggestions, allArguments, sections, adminIds, userInteractions] = await Promise.all([
      getCachedPublicProfiles(),
      base44.entities.Suggestion.filter({ documentId: doc.id }),
      base44.entities.Argument.list(),
      base44.entities.Section.filter({ documentId: doc.id }),
      getDocumentAdmins(doc.id),
      base44.entities.UserInteraction.filter({ documentId: doc.id })
    ]);
    
    console.log('[NOTIFY NEW SUGGESTION] Data fetched successfully:');
    console.log('[NOTIFY NEW SUGGESTION] - Public Profiles:', publicProfiles.length);
    console.log('[NOTIFY NEW SUGGESTION] - Suggestions in document:', allSuggestions.length);
    console.log('[NOTIFY NEW SUGGESTION] - Arguments (all):', allArguments.length);
    console.log('[NOTIFY NEW SUGGESTION] - Sections:', sections.length);
    console.log('[NOTIFY NEW SUGGESTION] - Admin IDs:', adminIds.length);
    console.log('[NOTIFY NEW SUGGESTION] - User Interactions:', userInteractions.length);
    
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

    // No auto-follow needed - notifications based on interactions only
    
    // ===== Build list of users to notify =====
    // Collect unique user IDs/emails from all interactions:
    // 1. Users who created suggestions in this document
    // 2. Users who voted on suggestions in this document
    // 3. Users who created arguments
    // 4. Users who commented (on suggestions, sections, or document)
    // 5. Section editors
    // 6. Document admins
    // 7. Document creator
    
    console.log('[NOTIFY NEW SUGGESTION] Building notification list based on interactions...');
    
    const userIdsToNotify = new Set();
    const userEmailsToNotify = new Set();
    
    // 1. Document creator
    if (doc.created_by) {
      userEmailsToNotify.add(doc.created_by);
    }
    
    // 2. Suggestion creators
    const suggestionCreators = allSuggestions
      .map(s => s.created_by)
      .filter(Boolean);
    console.log('[NOTIFY NEW SUGGESTION] Found', suggestionCreators.length, 'suggestion creators');
    suggestionCreators.forEach(email => userEmailsToNotify.add(email));
    
    // 3. Voters (need to get user emails from user IDs)
    const voterUserIds = [...new Set(allVotes
      .filter(v => suggestionIds.includes(v.suggestionId))
      .map(v => v.userId)
      .filter(Boolean))];
    console.log('[NOTIFY NEW SUGGESTION] Found', voterUserIds.length, 'voters');
    voterUserIds.forEach(id => userIdsToNotify.add(id));
    
    // 4. Argument creators
    const argumentCreators = allArguments
      .filter(arg => suggestionIds.includes(arg.suggestionId))
      .map(arg => arg.created_by)
      .filter(Boolean);
    console.log('[NOTIFY NEW SUGGESTION] Found', argumentCreators.length, 'argument creators');
    argumentCreators.forEach(email => userEmailsToNotify.add(email));
    
    // 5. Comment creators
    const relevantComments = allComments.filter(c => 
      (c.rootEntityType === 'suggestion' && suggestionIds.includes(c.rootEntityId)) ||
      (c.rootEntityType === 'section' && sections.map(s => s.id).includes(c.rootEntityId)) ||
      (c.rootEntityType === 'document' && c.rootEntityId === doc.id)
    );
    const commentCreators = relevantComments.map(c => c.created_by).filter(Boolean);
    console.log('[NOTIFY NEW SUGGESTION] Found', commentCreators.length, 'comment creators');
    commentCreators.forEach(email => userEmailsToNotify.add(email));
    
    // 6. Section editors
    const sectionEditors = sections
      .map(s => s.lastEditedBy)
      .filter(Boolean);
    console.log('[NOTIFY NEW SUGGESTION] Found', sectionEditors.length, 'section editors');
    sectionEditors.forEach(id => userIdsToNotify.add(id));
    
    // 7. Document admins
    adminIds.forEach(id => userIdsToNotify.add(id));
    
    // 8. All document participants (from UserInteraction)
    const participantUserIds = userInteractions.map(ui => ui.userId).filter(Boolean);
    console.log('[NOTIFY NEW SUGGESTION] Found', participantUserIds.length, 'document participants');
    participantUserIds.forEach(id => userIdsToNotify.add(id));
    
    // Fetch all users by IDs
    console.log('[NOTIFY NEW SUGGESTION] Fetching', userIdsToNotify.size, 'users by ID...');
    const usersByIds = userIdsToNotify.size > 0
      ? await base44.entities.User.filter({ id: { $in: Array.from(userIdsToNotify) } })
      : [];
    console.log('[NOTIFY NEW SUGGESTION] Fetched', usersByIds.length, 'user records by ID');
    
    // Fetch all users by emails
    console.log('[NOTIFY NEW SUGGESTION] Fetching', userEmailsToNotify.size, 'users by email...');
    const usersByEmails = userEmailsToNotify.size > 0
      ? await base44.entities.User.filter({ email: { $in: Array.from(userEmailsToNotify) } })
      : [];
    console.log('[NOTIFY NEW SUGGESTION] Fetched', usersByEmails.length, 'user records by email');
    
    // Combine all users and deduplicate
    const allRelevantUsers = [...usersByIds, ...usersByEmails];
    const uniqueUsersMap = new Map();
    allRelevantUsers.forEach(u => {
      if (u.id && u.email && u.email !== currentUser.email) {
        uniqueUsersMap.set(u.id, u);
      }
    });
    
    const uniqueUsers = Array.from(uniqueUsersMap.values());
    console.log('[NOTIFY NEW SUGGESTION] Total unique users to notify:', uniqueUsers.length);
    
    if (uniqueUsers.length === 0) {
      console.log('[NOTIFY NEW SUGGESTION] ✓ No users - skipping');
      return;
    }
    
    // Build action URL
    const actionUrl = relatedEntityType === 'topic_edit_suggestion' && topicId
      ? `${createPageUrl(PAGE_NAMES.DOCUMENT_VIEW)}?id=${doc.id}#topic-${topicId}`
      : `${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${suggestion.id}`;
    
    // Build notifications for all unique users
    const notifications = [];
    for (const user of uniqueUsers) {
      if (!user.id) {
        console.warn('[NOTIFY NEW SUGGESTION] Skipping user without ID');
        continue;
      }
      
      const userLang = user.preferredLanguage || 'he';

      const isEditOfSuggestion = suggestion.type === 'edit_suggestion';
      const title = isEditOfSuggestion ? translate('notifNewEditSuggestionTitle', userLang) : translate('notifNewSuggestionTitle', userLang);
      const message = isEditOfSuggestion 
        ? translate('notifNewEditSuggestionMessage', userLang, { name: currentUser.full_name, title: doc.title })
        : translate('notifNewSuggestionMessage', userLang, { name: currentUser.full_name, title: doc.title });

      notifications.push({
        userId: user.id,
        type: 'new_suggestion_in_followed_document',
        title: title,
        message: message,
        relatedEntityId: suggestion.id,
        relatedEntityType: relatedEntityType,
        actionUrl,
        documentId: doc.id,
        documentTitle: doc.title
      });
      }
    
    console.log('[NOTIFY NEW SUGGESTION] Prepared', notifications.length, 'notifications');
    
    if (notifications.length > 0) {
      const { successful, failed } = await batchCreateNotifications(notifications);
      console.log(`[NOTIFY NEW SUGGESTION] ✓ ${successful} sent, ${failed} failed`);
    }
    
    console.log('[NOTIFY NEW SUGGESTION] ===== END =====');
  } catch (error) {
    console.error('[NOTIFY NEW SUGGESTION] ✗ CRITICAL:', error?.message || error);
    console.error('[NOTIFY NEW SUGGESTION] Stack:', error?.stack);
    // Don't throw - notifications should not break the main flow
  }
}

/**
 * Create notification for new comment - for suggestion creator and all commenters
 */
export async function notifyNewComment({ comment, targetEntity, targetEntityType, parentComment = null, currentUser = null, documentId = null, documentTitle = null }) {
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
       actionUrl = `${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${targetEntity.id}&commentId=${comment.id}`;
     } else if (targetEntityType === 'section') {
       actionUrl = `${createPageUrl(PAGE_NAMES.SECTION_HISTORY)}?id=${targetEntity.id}&commentId=${comment.id}`;
     }
    
    // 1. Parent comment author (if this is a reply) - FIRST PRIORITY!
    let parentCommentAuthorEmail = null;
    if (parentComment?.created_by && parentComment.created_by !== comment.created_by) {
      parentCommentAuthorEmail = parentComment.created_by;
      notifiedEmails.add(parentCommentAuthorEmail);
    }
    
    // 2. Suggestion/section creator
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
    
    // 3. All previous commenters
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
    const commenterName = commenter.full_name || commenter.email?.split('@')[0] || 'User';
    
    // ===== Build notifications =====
    const emailToUser = {};
    users.forEach(u => {
      if (u.email && u.id) {
        emailToUser[u.email] = u;
      }
    });
    
    // 1. Parent comment author notification (reply) - FIRST PRIORITY
    if (parentCommentAuthorEmail && emailToUser[parentCommentAuthorEmail]) {
      const parentAuthor = emailToUser[parentCommentAuthorEmail];
      const userLang = parentAuthor.preferredLanguage || 'he';
      notifications.push({
        userId: parentAuthor.id,
        type: 'comment_reply',
        title: translate('notifReplyTitle', userLang),
        message: translate('notifReplyMessage', userLang, { name: commenterName }),
        relatedEntityId: comment.id,
        relatedEntityType: 'comment',
        actionUrl,
        documentId,
        documentTitle
      });
    }
    
    // 2. Owner notification (if not already notified as parent comment author)
    if (ownerEmail && emailToUser[ownerEmail] && ownerEmail !== parentCommentAuthorEmail) {
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
        actionUrl,
        documentId,
        documentTitle
      });
    }
    
    // 3. Previous commenters notifications (excluding owner and parent comment author)
    commentersEmails.forEach(email => {
      if (email !== ownerEmail && email !== parentCommentAuthorEmail && emailToUser[email]) {
        const user = emailToUser[email];
        const userLang = user.preferredLanguage || 'he';
        notifications.push({
          userId: user.id,
          type: targetEntityType === 'suggestion' ? 'suggestion_comment' : 'section_comment',
          title: translate('notifCommentTitle', userLang),
          message: translate('notifCommentOnDiscussion', userLang, { name: commenterName }),
          relatedEntityId: targetEntity.id,
          relatedEntityType: targetEntityType,
          actionUrl,
          documentId,
          documentTitle
        });
      }
    });
    
    if (notifications.length > 0) {
      const { successful, failed } = await batchCreateNotifications(notifications);
      console.log(`[NOTIFY COMMENT] ✓ ${successful} sent, ${failed} failed`);
    }
  } catch (error) {
    console.error('[NOTIFY COMMENT] Error:', error?.message || error);
  }
}

/**
 * Create notification for new comment in document general discussion
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
    const actionUrl = `${createPageUrl(PAGE_NAMES.DOCUMENT_VIEW)}?id=${doc.id}`;
    
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
    const commenterName = commenter.full_name || commenter.email?.split('@')[0] || 'User';
    
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
          relatedEntityId: comment.id,
          relatedEntityType: 'comment',
          actionUrl: `${actionUrl}#comment-${comment.id}`,
          documentId: doc.id,
          documentTitle: doc.title
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
        relatedEntityId: comment.id,
        relatedEntityType: 'comment',
        actionUrl: actionUrl + `#comment-${comment.id}`,
        documentId: doc.id,
        documentTitle: doc.title
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
        relatedEntityId: comment.id,
        relatedEntityType: 'comment',
        actionUrl: actionUrl + `#comment-${comment.id}`,
        documentId: doc.id,
        documentTitle: doc.title
      });
    });
    
    if (notifications.length > 0) {
      const { successful, failed } = await batchCreateNotifications(notifications);
      console.log(`[NOTIFY DOC COMMENT] ✓ ${successful} sent, ${failed} failed`);
    }
  } catch (error) {
    console.error('[NOTIFY DOC COMMENT] Error:', error?.message || error);
  }
}