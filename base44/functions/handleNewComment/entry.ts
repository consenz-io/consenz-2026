import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TRANSLATIONS = {
  en: {
    replyTitle: "Reply to your comment",
    replyMessage: "{name} replied to your comment",
    suggestionCommentTitle: "New comment on your suggestion",
    suggestionCommentMessage: "{name} commented on your suggestion",
    sectionCommentTitle: "New comment on your section",
    sectionCommentMessage: "{name} commented on your section",
  },
  he: {
    replyTitle: "תשובה לתגובה שלך",
    replyMessage: "{name} השיב לתגובה שלך",
    suggestionCommentTitle: "תגובה חדשה על ההצעה שלך",
    suggestionCommentMessage: "{name} הגיב על ההצעה שלך",
    sectionCommentTitle: "תגובה חדשה על הסעיף שלך",
    sectionCommentMessage: "{name} הגיב על הסעיף שלך",
  },
  ar: {
    replyTitle: "رد على تعليقك",
    replyMessage: "{name} رد على تعليقك",
    suggestionCommentTitle: "تعليق جديد على اقتراحك",
    suggestionCommentMessage: "{name} علق على اقتراحك",
    sectionCommentTitle: "تعليق جديد على قسمك",
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

function buildTranslations(titleKey, messageKey, replacements = {}) {
  const result = {};
  for (const lang of ['en', 'he', 'ar']) {
    result[lang] = {
      title: t(lang, titleKey, replacements),
      message: t(lang, messageKey, replacements),
    };
  }
  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: comment } = await req.json();

    if (!comment || event.type !== 'create') {
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    console.log('[AUTOMATION] New comment created:', comment.id);

    const commenterProfile = await base44.asServiceRole.entities.UserPublicProfile.filter({ email: comment.created_by }).then(p => p[0]);
    const commenterName = commenterProfile?.fullName || 'User';
    const commenterUser = await base44.asServiceRole.entities.User.filter({ email: comment.created_by }).then(u => u[0]);

    const notifications = [];

    if (comment.rootEntityType === 'suggestion') {
      const suggestions = await base44.asServiceRole.entities.Suggestion.filter({ id: comment.rootEntityId });
      const suggestion = suggestions[0];
      if (!suggestion) {
        return Response.json({ message: 'Suggestion not found' }, { status: 200 });
      }

      // Fetch the document to build the URL
      const suggestionDoc = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }).then(d => d[0]);
      const actionUrl = suggestionDoc
        ? `/documentview?id=${suggestionDoc.id}&suggestionId=${suggestion.id}&commentId=${comment.id}`
        : `/documentview?suggestionId=${suggestion.id}&commentId=${comment.id}`;
      const nameReplacements = { name: commenterName };

      // Reply notification
      if (comment.parentCommentId) {
        const parentComment = await base44.asServiceRole.entities.Comment.filter({ id: comment.parentCommentId }).then(c => c[0]);
        if (parentComment && parentComment.created_by !== comment.created_by) {
          const parentUser = await base44.asServiceRole.entities.User.filter({ email: parentComment.created_by }).then(u => u[0]);
          if (parentUser) {
            const userLang = parentUser.preferredLanguage || 'he';
            notifications.push({
              userId: parentUser.id,
              type: 'comment_reply',
              title: t(userLang, 'replyTitle', nameReplacements),
              message: t(userLang, 'replyMessage', nameReplacements),
              translations: buildTranslations('replyTitle', 'replyMessage', nameReplacements),
              relatedEntityId: comment.id,
              relatedEntityType: 'comment',
              actionUrl,
              read: false
            });
          }
        }
      }

      // Suggestion creator notification (if not the commenter and not already notified)
      const creatorUser = await base44.asServiceRole.entities.User.filter({ email: suggestion.created_by }).then(u => u[0]);
      const alreadyNotified = notifications.some(n => n.userId === creatorUser?.id);
      if (creatorUser && creatorUser.id !== commenterUser?.id && !alreadyNotified) {
        const userLang = creatorUser.preferredLanguage || 'he';
        notifications.push({
          userId: creatorUser.id,
          type: 'suggestion_comment',
          title: t(userLang, 'suggestionCommentTitle', nameReplacements),
          message: t(userLang, 'suggestionCommentMessage', nameReplacements),
          translations: buildTranslations('suggestionCommentTitle', 'suggestionCommentMessage', nameReplacements),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl,
          read: false
        });
      }

    } else if (comment.rootEntityType === 'section') {
      const sections = await base44.asServiceRole.entities.Section.filter({ id: comment.rootEntityId });
      const section = sections[0];
      if (!section) {
        return Response.json({ message: 'Section not found' }, { status: 200 });
      }

      const actionUrl = `/documentview?id=${section.documentId}&commentId=${comment.id}`;
      const nameReplacements = { name: commenterName };

      // Reply notification
      if (comment.parentCommentId) {
        const parentComment = await base44.asServiceRole.entities.Comment.filter({ id: comment.parentCommentId }).then(c => c[0]);
        if (parentComment && parentComment.created_by !== comment.created_by) {
          const parentUser = await base44.asServiceRole.entities.User.filter({ email: parentComment.created_by }).then(u => u[0]);
          if (parentUser) {
            const userLang = parentUser.preferredLanguage || 'he';
            notifications.push({
              userId: parentUser.id,
              type: 'comment_reply',
              title: t(userLang, 'replyTitle', nameReplacements),
              message: t(userLang, 'replyMessage', nameReplacements),
              translations: buildTranslations('replyTitle', 'replyMessage', nameReplacements),
              relatedEntityId: comment.id,
              relatedEntityType: 'comment',
              actionUrl,
              read: false
            });
          }
        }
      }

      // Section last editor notification
      if (section.lastEditedBy && section.lastEditedBy !== commenterUser?.id) {
        const editorUser = await base44.asServiceRole.entities.User.filter({ id: section.lastEditedBy }).then(u => u[0]);
        const alreadyNotified = notifications.some(n => n.userId === editorUser?.id);
        if (editorUser && !alreadyNotified) {
          const userLang = editorUser.preferredLanguage || 'he';
          notifications.push({
            userId: editorUser.id,
            type: 'section_comment',
            title: t(userLang, 'sectionCommentTitle', nameReplacements),
            message: t(userLang, 'sectionCommentMessage', nameReplacements),
            translations: buildTranslations('sectionCommentTitle', 'sectionCommentMessage', nameReplacements),
            relatedEntityId: section.id,
            relatedEntityType: 'section',
            actionUrl,
            read: false
          });
        }
      }
    }

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
      console.log(`[AUTOMATION] Created ${notifications.length} comment notifications`);
    }

    return Response.json({ success: true, notificationsSent: notifications.length });
  } catch (error) {
    console.error('[AUTOMATION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});