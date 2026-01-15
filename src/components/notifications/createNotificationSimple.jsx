import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

// Simple translation function
function translate(key, lang) {
  const translations = {
    en: {
      newSuggestion: "New suggestion in document",
      suggestionAccepted: "Suggestion accepted in document",
      newComment: "New comment",
      voting: "{name} voted on a suggestion",
    },
    he: {
      newSuggestion: "הצעה חדשה במסמך",
      suggestionAccepted: "הצעה התקבלה במסמך",
      newComment: "הערה חדשה",
      voting: "{name} הצביע על הצעה",
    },
    ar: {
      newSuggestion: "اقتراح جديد في المستند",
      suggestionAccepted: "تم قبول الاقتراح في المستند",
      newComment: "تعليق جديد",
      voting: "{name} صوت على اقتراح",
    }
  };
  
  return translations[lang]?.[key] || translations['he'][key] || key;
}

// Generic notification creator
async function createNotification({
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
  if (!userId) return;
  
  try {
    // Create notification in DB
    await base44.entities.Notification.create({
      userId,
      type,
      title,
      message,
      relatedEntityId,
      relatedEntityType,
      actionUrl,
      read: false
    });
    
    // Add to email digest
    const { addToEmailDigest } = await import('./addToEmailDigest');
    await addToEmailDigest({
      userId,
      notificationType: type,
      title,
      message,
      actionUrl,
      relatedEntityType,
      relatedEntityId,
      documentId,
      documentTitle
    });
  } catch (error) {
    console.error('[NOTIFICATION] Error:', error);
  }
}

/**
 * RULE 1: New suggestion in document
 * Send to: All document participants (UserInteraction) + followers
 */
export async function notifyNewSuggestion({ suggestion, document: doc, currentUser }) {
  console.log('[notifyNewSuggestion] START - suggestion:', suggestion?.id, 'doc:', doc?.id, 'user:', currentUser?.id);
  
  if (!suggestion?.id || !doc?.id || !currentUser?.id) {
    console.error('[notifyNewSuggestion] Missing required data');
    return;
  }

  try {
    // Get all participants in the document (UserInteraction table)
    const participants = await base44.entities.UserInteraction.filter({ documentId: doc.id });
    console.log('[notifyNewSuggestion] Found participants:', participants.length);
    
    // Get document followers
    const followers = await base44.entities.DocumentFollow.filter({ documentId: doc.id });
    console.log('[notifyNewSuggestion] Found followers:', followers.length);

    // Combine all user IDs (remove duplicates and exclude creator)
    const userIds = new Set([
      ...participants.map(p => p.userId),
      ...followers.map(f => f.userId)
    ]);
    userIds.delete(currentUser.id); // Remove creator
    
    console.log('[notifyNewSuggestion] Total unique users to notify:', userIds.size);
    
    if (userIds.size === 0) {
      console.log('[notifyNewSuggestion] No users to notify');
      return;
    }

    // Fetch user data from UserPublicProfile (reliable and accessible)
    const userIdsArray = Array.from(userIds);
    const publicProfiles = await base44.entities.UserPublicProfile.filter({ 
      userId: { $in: userIdsArray } 
    });
    console.log('[notifyNewSuggestion] Found public profiles:', publicProfiles.length);

    if (publicProfiles.length === 0) {
      console.warn('[notifyNewSuggestion] No public profiles found for users');
      return;
    }

    // Create notifications in parallel
    const creatorName = currentUser.full_name || currentUser.email?.split('@')[0] || 'Someone';
    const notifications = publicProfiles.map(profile =>
      createNotification({
        userId: profile.userId,
        type: 'new_suggestion',
        title: translate('newSuggestion', 'he'),
        message: `${creatorName} הוסיף/ה הצעה במסמך "${doc.title}"`,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl: `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`,
        documentId: doc.id,
        documentTitle: doc.title
      })
    );
    
    await Promise.all(notifications);
    console.log('[notifyNewSuggestion] SUCCESS - sent', notifications.length, 'notifications');
  } catch (error) {
    console.error('[notifyNewSuggestion] ERROR:', error);
    console.error('[notifyNewSuggestion] Stack:', error.stack);
  }
}

/**
 * RULE 2: Suggestion accepted
 * Send to: All document participants + followers + voters
 */
export async function notifySuggestionAccepted({ suggestion, document: doc }) {
  console.log('[notifySuggestionAccepted] START - suggestion:', suggestion?.id, 'doc:', doc?.id);
  
  if (!suggestion?.id || !doc?.id) {
    console.error('[notifySuggestionAccepted] Missing required data');
    return;
  }

  try {
    // Get participants, followers and pro-voters
    const [participants, followers, proVotes] = await Promise.all([
      base44.entities.UserInteraction.filter({ documentId: doc.id }),
      base44.entities.DocumentFollow.filter({ documentId: doc.id }),
      base44.entities.Vote.filter({ suggestionId: suggestion.id, vote: 'pro' })
    ]);

    console.log('[notifySuggestionAccepted] participants:', participants.length, 'followers:', followers.length, 'voters:', proVotes.length);

    // Combine IDs (remove duplicates)
    const userIds = new Set([
      ...participants.map(p => p.userId),
      ...followers.map(f => f.userId),
      ...proVotes.map(v => v.userId)
    ]);

    console.log('[notifySuggestionAccepted] Total unique users to notify:', userIds.size);

    if (userIds.size === 0) {
      console.log('[notifySuggestionAccepted] No users to notify');
      return;
    }

    // Fetch user data from UserPublicProfile
    const publicProfiles = await base44.entities.UserPublicProfile.filter({ 
      userId: { $in: Array.from(userIds) } 
    });
    console.log('[notifySuggestionAccepted] Found public profiles:', publicProfiles.length);

    if (publicProfiles.length === 0) {
      console.warn('[notifySuggestionAccepted] No public profiles found');
      return;
    }

    // Create notifications in parallel
    const notifications = publicProfiles.map(profile =>
      createNotification({
        userId: profile.userId,
        type: 'suggestion_accepted',
        title: translate('suggestionAccepted', 'he'),
        message: `ההצעה "${suggestion.title}" התקבלה במסמך "${doc.title}"`,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl: `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`,
        documentId: doc.id,
        documentTitle: doc.title
      })
    );
    
    await Promise.all(notifications);
    console.log('[notifySuggestionAccepted] SUCCESS - sent', notifications.length, 'notifications');
  } catch (error) {
    console.error('[notifySuggestionAccepted] ERROR:', error);
    console.error('[notifySuggestionAccepted] Stack:', error.stack);
  }
}

/**
 * RULE 3: New comment on suggestion, section, or document
 * Send to: Entity creator + all previous commenters + parent comment author + siblings (if reply)
 */
export async function notifyNewComment({ comment, targetEntity, targetEntityType, currentUser, parentComment = null, documentId = null, documentTitle = null }) {
  console.log('[notifyNewComment] START - comment:', comment?.id, 'entity:', targetEntity?.id, 'type:', targetEntityType);
  
  if (!comment?.id || !targetEntity?.id || !targetEntityType || !currentUser?.id) {
    console.error('[notifyNewComment] Missing required data');
    return;
  }

  try {
    const notifyUserIds = new Set();

    // Priority 1: If replying to a comment, notify the parent comment author + all replies to it
    if (parentComment?.created_by && parentComment.created_by !== currentUser.email) {
      // Get parent author's userId
      const parentProfiles = await base44.entities.UserPublicProfile.filter({ 
        email: parentComment.created_by 
      });
      if (parentProfiles[0]?.userId) notifyUserIds.add(parentProfiles[0].userId);
      
      // Also notify all previous replies to the parent comment
      const parentReplies = await base44.entities.Comment.filter({
        parentCommentId: parentComment.id
      });
      
      if (parentReplies.length > 0) {
        const replyEmails = [...new Set(parentReplies.map(r => r.created_by).filter(e => e && e !== currentUser.email))];
        const replyProfiles = await base44.entities.UserPublicProfile.filter({
          email: { $in: replyEmails }
        });
        replyProfiles.forEach(p => notifyUserIds.add(p.userId));
      }
    }

    // Entity creator/owner
    if (targetEntityType === 'suggestion' && targetEntity.created_by) {
      const creatorProfiles = await base44.entities.UserPublicProfile.filter({ 
        email: targetEntity.created_by 
      });
      if (creatorProfiles[0]?.userId && creatorProfiles[0].userId !== currentUser.id) {
        notifyUserIds.add(creatorProfiles[0].userId);
      }
    } else if (targetEntityType === 'section' && targetEntity.lastEditedBy && targetEntity.lastEditedBy !== currentUser.id) {
      notifyUserIds.add(targetEntity.lastEditedBy);
    } else if (targetEntityType === 'document' && targetEntity.created_by) {
      const creatorProfiles = await base44.entities.UserPublicProfile.filter({ 
        email: targetEntity.created_by 
      });
      if (creatorProfiles[0]?.userId && creatorProfiles[0].userId !== currentUser.id) {
        notifyUserIds.add(creatorProfiles[0].userId);
      }
    }

    // Previous commenters on this entity
    const allComments = await base44.entities.Comment.filter({
      rootEntityType: targetEntityType,
      rootEntityId: targetEntity.id
    });
    
    if (allComments.length > 0) {
      const commenterEmails = [...new Set(allComments.map(c => c.created_by).filter(e => e && e !== currentUser.email))];
      const commenterProfiles = await base44.entities.UserPublicProfile.filter({
        email: { $in: commenterEmails }
      });
      commenterProfiles.forEach(p => notifyUserIds.add(p.userId));
    }

    console.log('[notifyNewComment] Total users to notify:', notifyUserIds.size);

    if (notifyUserIds.size === 0) {
      console.log('[notifyNewComment] No users to notify');
      return;
    }

    // Create notifications in parallel
    const creatorName = currentUser.full_name || currentUser.email?.split('@')[0] || 'Someone';
    const notifications = Array.from(notifyUserIds).map(userId =>
      createNotification({
        userId,
        type: 'new_comment',
        title: translate('newComment', 'he'),
        message: `${creatorName} הגיב/ה על ${targetEntityType === 'suggestion' ? 'הצעה' : targetEntityType === 'section' ? 'סעיף' : 'מסמך'}`,
        relatedEntityId: targetEntity.id,
        relatedEntityType: targetEntityType,
        actionUrl: targetEntityType === 'suggestion'
          ? `${createPageUrl("SuggestionDetail")}?id=${targetEntity.id}#comment-${comment.id}`
          : targetEntityType === 'section'
          ? `${createPageUrl("SectionHistory")}?id=${targetEntity.id}#comment-${comment.id}`
          : `${createPageUrl("DocumentView")}?id=${targetEntity.id}#comment-${comment.id}`,
        documentId: documentId || targetEntity.documentId,
        documentTitle: documentTitle || targetEntity.title
      })
    );
    
    await Promise.all(notifications);
    console.log('[notifyNewComment] SUCCESS - sent', notifications.length, 'notifications');
  } catch (error) {
    console.error('[notifyNewComment] ERROR:', error);
    console.error('[notifyNewComment] Stack:', error.stack);
  }
}

/**
 * OPTIONAL: Vote on suggestion (simple - just notify creator)
 */
export async function notifyVote({ suggestion, voterName, voterEmail }) {
  console.log('[notifyVote] START - suggestion:', suggestion?.id, 'voter:', voterEmail);
  
  if (!suggestion?.created_by || suggestion.created_by === voterEmail) {
    console.log('[notifyVote] Skipping - creator is voter or missing data');
    return;
  }

  try {
    const creatorProfiles = await base44.entities.UserPublicProfile.filter({ 
      email: suggestion.created_by 
    });
    
    if (!creatorProfiles[0]?.userId) {
      console.warn('[notifyVote] Creator profile not found');
      return;
    }

    await createNotification({
      userId: creatorProfiles[0].userId,
      type: 'vote',
      title: 'הצבעה חדשה',
      message: `${voterName || 'מישהו'} הצביע/ה על ההצעה שלך`,
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`
    });
    
    console.log('[notifyVote] SUCCESS - notified creator');
  } catch (error) {
    console.error('[notifyVote] ERROR:', error);
    console.error('[notifyVote] Stack:', error.stack);
  }
}