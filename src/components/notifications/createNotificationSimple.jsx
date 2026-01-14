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
 * Send to: All document followers
 */
export async function notifyNewSuggestion({ suggestion, document: doc, currentUser }) {
  if (!suggestion?.id || !doc?.id || !currentUser?.id) return;

  try {
    // Get document followers (excluding the creator)
    const followers = await base44.entities.DocumentFollow.filter({ documentId: doc.id });
    const followerIds = followers
      .map(f => f.userId)
      .filter(id => id !== currentUser.id);

    if (followerIds.length === 0) return;

    // Fetch follower users
    const users = await base44.entities.User.filter({ id: { $in: followerIds } });

    // Create notifications in parallel
    await Promise.all(
      users.map(user =>
        createNotification({
          userId: user.id,
          type: 'new_suggestion',
          title: translate('newSuggestion', user.preferredLanguage || 'he'),
          message: `${currentUser.full_name} added a suggestion in "${doc.title}"`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl: `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`,
          documentId: doc.id,
          documentTitle: doc.title
        })
      )
    );
  } catch (error) {
    console.error('[NOTIFICATION ERROR] notifyNewSuggestion:', error);
  }
}

/**
 * RULE 2: Suggestion accepted
 * Send to: All document followers + voters
 */
export async function notifySuggestionAccepted({ suggestion, document: doc }) {
  if (!suggestion?.id || !doc?.id) return;

  try {
    // Get followers and pro-voters
    const [followers, proVotes] = await Promise.all([
      base44.entities.DocumentFollow.filter({ documentId: doc.id }),
      base44.entities.Vote.filter({ suggestionId: suggestion.id, vote: 'pro' })
    ]);

    // Combine IDs (remove duplicates)
    const userIds = new Set([
      ...followers.map(f => f.userId),
      ...proVotes.map(v => v.userId)
    ]);

    if (userIds.size === 0) return;

    // Fetch users
    const users = await base44.entities.User.filter({ 
      id: { $in: Array.from(userIds) } 
    });

    // Create notifications in parallel
    await Promise.all(
      users.map(user =>
        createNotification({
          userId: user.id,
          type: 'suggestion_accepted',
          title: translate('suggestionAccepted', user.preferredLanguage || 'he'),
          message: `The suggestion "${suggestion.title}" was accepted in "${doc.title}"`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl: `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`,
          documentId: doc.id,
          documentTitle: doc.title
        })
      )
    );
  } catch (error) {
    console.error('[NOTIFICATION ERROR] notifySuggestionAccepted:', error);
  }
}

/**
 * RULE 3: New comment on suggestion or section
 * Send to: Entity creator + all previous commenters + parent comment author + siblings (if reply)
 */
export async function notifyNewComment({ comment, targetEntity, targetEntityType, currentUser, parentComment = null, document = null }) {
  if (!comment?.id || !targetEntity?.id || !targetEntityType || !currentUser?.id) return;

  try {
    const notifyEmails = new Set();

    // Priority 1: If replying to a comment, notify the parent comment author + all replies to it
    if (parentComment?.created_by && parentComment.created_by !== currentUser.email) {
      notifyEmails.add(parentComment.created_by);
      
      // Also notify all previous replies to the parent comment
      const parentReplies = await base44.entities.Comment.filter({
        parentCommentId: parentComment.id
      });
      parentReplies.forEach(reply => {
        if (reply.created_by && reply.created_by !== currentUser.email) {
          notifyEmails.add(reply.created_by);
        }
      });
    }

    // Entity creator/owner
    if (targetEntityType === 'suggestion' && targetEntity.created_by) {
      notifyEmails.add(targetEntity.created_by);
    } else if (targetEntityType === 'section' && targetEntity.lastEditedBy) {
      // Get user email correctly
      const ownerResult = await base44.entities.User.filter({ id: targetEntity.lastEditedBy });
      if (ownerResult[0]?.email) notifyEmails.add(ownerResult[0].email);
    }

    // Previous commenters on this entity
    const allComments = await base44.entities.Comment.filter({
      rootEntityType: targetEntityType,
      rootEntityId: targetEntity.id
    });
    allComments.forEach(c => {
      if (c.created_by && c.created_by !== currentUser.email) {
        notifyEmails.add(c.created_by);
      }
    });

    // Remove current commenter
    notifyEmails.delete(currentUser.email);

    if (notifyEmails.size === 0) return;

    // Fetch users
    const users = await base44.entities.User.filter({
      email: { $in: Array.from(notifyEmails) }
    });

    // Create notifications in parallel
    await Promise.all(
      users.map(user =>
        createNotification({
          userId: user.id,
          type: 'new_comment',
          title: translate('newComment', user.preferredLanguage || 'he'),
          message: `${currentUser.full_name} commented on a ${targetEntityType}`,
          relatedEntityId: targetEntity.id,
          relatedEntityType: targetEntityType,
          actionUrl: targetEntityType === 'suggestion'
            ? `${createPageUrl("SuggestionDetail")}?id=${targetEntity.id}`
            : `${createPageUrl("SectionHistory")}?id=${targetEntity.id}`,
          documentId: document?.id,
          documentTitle: document?.title
        })
      )
    );
  } catch (error) {
    console.error('[NOTIFICATION ERROR] notifyNewComment:', error);
  }
}

/**
 * OPTIONAL: Vote on suggestion (simple - just notify creator)
 */
export async function notifyVote({ suggestion, voterName, voterEmail }) {
  if (!suggestion?.created_by || suggestion.created_by === voterEmail) return;

  try {
    const creator = await base44.entities.User.filter({ email: suggestion.created_by });
    if (!creator[0]) return;

    await createNotification({
      userId: creator[0].id,
      type: 'vote',
      title: 'New vote',
      message: `${voterName} voted on your suggestion`,
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`
    });
  } catch (error) {
    console.error('[NOTIFICATION ERROR] notifyVote:', error);
  }
}