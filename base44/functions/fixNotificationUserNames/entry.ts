import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Migration: Fix notifications where "User" was baked in as the actor name
// instead of the real full name. This happens when UserPublicProfile didn't
// exist yet at notification creation time (race condition with Layout.jsx).

const TRANSLATIONS = {
  en: {
    newSuggestionMessage: "{name} added a new suggestion in the document \"{title}\"",
    editSuggestionMessage: "{name} suggested an edit to a suggestion in document \"{title}\"",
    replyMessage: "{name} replied to your comment",
    suggestionCommentMessage: "{name} commented on your suggestion",
    sectionCommentMessage: "{name} commented on your section",
  },
  he: {
    newSuggestionMessage: "{name} הוסיף הצעה חדשה במסמך \"{title}\"",
    editSuggestionMessage: "{name} הציע/ה עריכה להצעה במסמך \"{title}\"",
    replyMessage: "{name} השיב לתגובה שלך",
    suggestionCommentMessage: "{name} הגיב על ההצעה שלך",
    sectionCommentMessage: "{name} הגיב על הסעיף שלך",
  },
  ar: {
    newSuggestionMessage: "{name} أضاف اقتراحًا جديدًا في المستند \"{title}\"",
    editSuggestionMessage: "{name} اقترح تعديلاً على اقتراح في المستند \"{title}\"",
    replyMessage: "{name} رد على تعليقك",
    suggestionCommentMessage: "{name} علق على اقتراحك",
    sectionCommentMessage: "{name} علق على قسمك",
  }
};

function t(lang, key, replacements = {}) {
  let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['he'][key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

// Check if a message contains the "User" fallback placeholder
function hasUserPlaceholder(message) {
  if (!message || typeof message !== 'string') return false;
  // Match "User " at word boundary in English, or standalone "User" token
  return /\bUser\b/.test(message);
}

// Resolve a user's display name: UserPublicProfile.fullName → User.full_name → null
async function resolveUserName(base44, userId) {
  if (!userId) return null;
  try {
    const [profiles, users] = await Promise.all([
      base44.asServiceRole.entities.UserPublicProfile.filter({ userId }),
      base44.asServiceRole.entities.User.filter({ id: userId })
    ]);
    return profiles[0]?.fullName || users[0]?.full_name || null;
  } catch (e) {
    console.error('[FIX NOTIF NAMES] Error resolving name for', userId, e.message);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    console.log('[FIX NOTIF NAMES] ===== START =====');

    // Fetch all notifications that might contain "User" placeholder
    // These types include actor names in their message templates
    const nameNotifTypes = [
      'new_suggestion_in_followed_document',
      'comment_reply',
      'suggestion_comment',
      'section_comment',
    ];

    let allNotifs = [];
    for (const type of nameNotifTypes) {
      try {
        const notifs = await base44.asServiceRole.entities.Notification.filter({ type });
        allNotifs = allNotifs.concat(notifs);
      } catch (e) {
        console.error('[FIX NOTIF NAMES] Error fetching type', type, e.message);
      }
    }

    console.log('[FIX NOTIF NAMES] Total candidate notifications:', allNotifs.length);

    // Filter to only those with "User" placeholder in message or translations
    const brokenNotifs = allNotifs.filter(n => {
      if (hasUserPlaceholder(n.message)) return true;
      if (n.translations) {
        for (const lang of ['en', 'he', 'ar']) {
          if (n.translations[lang] && hasUserPlaceholder(n.translations[lang].message)) return true;
        }
      }
      return false;
    });

    console.log('[FIX NOTIF NAMES] Notifications with "User" placeholder:', brokenNotifs.length);

    if (brokenNotifs.length === 0) {
      return Response.json({ success: true, fixed: 0, message: 'No broken notifications found' });
    }

    // Collect all unique suggestion IDs and comment IDs to resolve actor userIds
    const suggestionIds = new Set();
    const commentIds = new Set();

    for (const n of brokenNotifs) {
      if (n.type === 'new_suggestion_in_followed_document') {
        if (n.relatedEntityId) suggestionIds.add(n.relatedEntityId);
      } else if (n.type === 'comment_reply') {
        // relatedEntityId = comment.id
        if (n.relatedEntityId) commentIds.add(n.relatedEntityId);
      } else if (n.type === 'suggestion_comment') {
        // relatedEntityId = suggestion.id — the commenter is NOT the suggestion creator.
        // We need to find the comment that triggered this. We'll search for comments on this suggestion.
        if (n.relatedEntityId) suggestionIds.add(n.relatedEntityId);
      } else if (n.type === 'section_comment') {
        // relatedEntityId = section.id — we'll search for comments on this section.
        // Handled below.
      }
    }

    // Fetch suggestions to get creator IDs
    const suggestionMap = new Map();
    if (suggestionIds.size > 0) {
      const suggestions = await base44.asServiceRole.entities.Suggestion.filter({
        id: { $in: [...suggestionIds] }
      });
      suggestions.forEach(s => suggestionMap.set(s.id, s));
    }

    // Fetch comments (for comment_reply) to get commenter IDs
    const commentMap = new Map();
    if (commentIds.size > 0) {
      const comments = await base44.asServiceRole.entities.Comment.filter({
        id: { $in: [...commentIds] }
      });
      comments.forEach(c => commentMap.set(c.id, c));
    }

    // For suggestion_comment / section_comment: fetch comments on those entities
    // to find the commenter around the notification creation time
    const entityCommentMap = new Map(); // key: `${type}:${entityId}` → latest comment before notif
    const sectionCommentNotifs = brokenNotifs.filter(n => n.type === 'section_comment');
    const suggestionCommentNotifs = brokenNotifs.filter(n => n.type === 'suggestion_comment');

    // Fetch comments for suggestion_comment notifications
    if (suggestionCommentNotifs.length > 0) {
      for (const n of suggestionCommentNotifs) {
        try {
          const comments = await base44.asServiceRole.entities.Comment.filter({
            rootEntityType: 'suggestion',
            rootEntityId: n.relatedEntityId
          });
          // Find the comment closest to (but before or at) the notification creation time
          const notifTime = new Date(n.created_date).getTime();
          const candidate = comments
            .filter(c => new Date(c.created_date).getTime() <= notifTime + 60000)
            .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
          if (candidate) {
            entityCommentMap.set(`suggestion_comment:${n.id}`, candidate);
          }
        } catch (e) {
          console.error('[FIX NOTIF NAMES] Error fetching comments for suggestion_comment', n.id, e.message);
        }
      }
    }

    // Fetch comments for section_comment notifications
    if (sectionCommentNotifs.length > 0) {
      for (const n of sectionCommentNotifs) {
        try {
          const comments = await base44.asServiceRole.entities.Comment.filter({
            rootEntityType: 'section',
            rootEntityId: n.relatedEntityId
          });
          const notifTime = new Date(n.created_date).getTime();
          const candidate = comments
            .filter(c => new Date(c.created_date).getTime() <= notifTime + 60000)
            .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
          if (candidate) {
            entityCommentMap.set(`section_comment:${n.id}`, candidate);
          }
        } catch (e) {
          console.error('[FIX NOTIF NAMES] Error fetching comments for section_comment', n.id, e.message);
        }
      }
    }

    // Resolve actor userId for each broken notification
    const actorIds = new Set();
    const notifActorMap = new Map(); // notifId → actorUserId

    for (const n of brokenNotifs) {
      let actorId = null;
      if (n.type === 'new_suggestion_in_followed_document') {
        const sugg = suggestionMap.get(n.relatedEntityId);
        actorId = sugg?.created_by_id;
      } else if (n.type === 'comment_reply') {
        const comment = commentMap.get(n.relatedEntityId);
        actorId = comment?.created_by_id;
      } else if (n.type === 'suggestion_comment' || n.type === 'section_comment') {
        const comment = entityCommentMap.get(`${n.type}:${n.id}`);
        actorId = comment?.created_by_id;
      }
      if (actorId) {
        notifActorMap.set(n.id, actorId);
        actorIds.add(actorId);
      }
    }

    console.log('[FIX NOTIF NAMES] Unique actors to resolve:', actorIds.size);

    // Resolve names for all actors
    const nameMap = new Map(); // userId → fullName
    for (const actorId of actorIds) {
      const name = await resolveUserName(base44, actorId);
      if (name) nameMap.set(actorId, name);
    }

    console.log('[FIX NOTIF NAMES] Names resolved:', nameMap.size, '/', actorIds.size);

    // Rebuild and update each notification
    let fixed = 0;
    let skipped = 0;

    for (const n of brokenNotifs) {
      const actorId = notifActorMap.get(n.id);
      const resolvedName = actorId ? nameMap.get(actorId) : null;

      if (!resolvedName) {
        console.log('[FIX NOTIF NAMES] Skipping', n.id, '- could not resolve actor name');
        skipped++;
        continue;
      }

      // Determine message key and replacements
      let messageKey = null;
      let replacements = { name: resolvedName };

      if (n.type === 'new_suggestion_in_followed_document') {
        const sugg = suggestionMap.get(n.relatedEntityId);
        const isEdit = sugg?.type === 'edit_suggestion';
        messageKey = isEdit ? 'editSuggestionMessage' : 'newSuggestionMessage';
        // Fetch document title for the replacement
        let docTitle = '';
        if (sugg?.documentId) {
          try {
            const docs = await base44.asServiceRole.entities.Document.filter({ id: sugg.documentId });
            docTitle = docs[0]?.title || '';
          } catch (e) { /* ignore */ }
        }
        replacements.title = docTitle;
      } else if (n.type === 'comment_reply') {
        messageKey = 'replyMessage';
      } else if (n.type === 'suggestion_comment') {
        messageKey = 'suggestionCommentMessage';
      } else if (n.type === 'section_comment') {
        messageKey = 'sectionCommentMessage';
      }

      if (!messageKey) {
        skipped++;
        continue;
      }

      // Build new translations object
      const newTranslations = {};
      for (const lang of ['en', 'he', 'ar']) {
        newTranslations[lang] = {
          title: n.translations?.[lang]?.title || n.title,
          message: t(lang, messageKey, replacements),
        };
      }

      // Use Hebrew as the default stored message (matching original creation pattern)
      const newMessage = t('he', messageKey, replacements);

      try {
        await base44.asServiceRole.entities.Notification.update(n.id, {
          message: newMessage,
          translations: newTranslations,
        });
        fixed++;
      } catch (e) {
        console.error('[FIX NOTIF NAMES] Error updating notification', n.id, e.message);
        skipped++;
      }
    }

    console.log('[FIX NOTIF NAMES] ===== DONE ===== Fixed:', fixed, 'Skipped:', skipped);
    return Response.json({ success: true, fixed, skipped, totalBroken: brokenNotifs.length });
  } catch (error) {
    console.error('[FIX NOTIF NAMES ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});