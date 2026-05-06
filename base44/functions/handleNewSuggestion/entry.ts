import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TRANSLATIONS = {
  en: {
    newSuggestionTitle: "New suggestion in document",
    newSuggestionMessage: "{name} added a new suggestion in the document \"{title}\"",
    editSuggestionTitle: "Suggestion to edit a suggestion",
    editSuggestionMessage: "{name} suggested an edit to a suggestion in document \"{title}\"",
  },
  he: {
    newSuggestionTitle: "הצעה חדשה במסמך",
    newSuggestionMessage: "{name} הוסיף הצעה חדשה במסמך \"{title}\"",
    editSuggestionTitle: "הצעה לעריכת הצעה",
    editSuggestionMessage: "{name} הציע/ה עריכה להצעה במסמך \"{title}\"",
  },
  ar: {
    newSuggestionTitle: "اقتراح جديد في المستند",
    newSuggestionMessage: "{name} أضاف اقتراحًا جديدًا في المستند \"{title}\"",
    editSuggestionTitle: "اقتراح لتعديل اقتراح",
    editSuggestionMessage: "{name} اقترح تعديلاً على اقتراح في المستند \"{title}\"",
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
  const startTime = Date.now();
  console.log('[SUGGESTION AUTOMATION] ===== START =====');

  try {
    const base44 = createClientFromRequest(req);
    const { event, data: suggestion } = await req.json();

    if (!suggestion || event.type !== 'create') {
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    console.log('[SUGGESTION AUTOMATION] Processing new suggestion:', suggestion.id);

    const [documents, interactions, creatorProfiles] = await Promise.all([
      base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }),
      base44.asServiceRole.entities.UserInteraction.filter({ documentId: suggestion.documentId }),
      base44.asServiceRole.entities.UserPublicProfile.filter({ email: suggestion.created_by })
    ]);

    const document = documents[0];
    if (!document) {
      return Response.json({ message: 'Document not found' }, { status: 404 });
    }

    const creatorProfile = creatorProfiles[0];
    const creatorName = creatorProfile?.fullName || 'User';

    // Collect user IDs from interactions + group members (if document belongs to a group)
    const interactionUserIds = new Set(interactions.map(i => i.userId));

    if (document.groupId) {
      const groupMembers = await base44.asServiceRole.entities.GroupMember.filter({ groupId: document.groupId });
      groupMembers.forEach(m => { if (m.userId) interactionUserIds.add(m.userId); });
      console.log('[SUGGESTION AUTOMATION] Added', groupMembers.length, 'group members to notify list');
    }

    // Exclude the suggestion creator from notifications
    const uniqueUserIds = [...interactionUserIds].filter(uid => uid !== suggestion.created_by);

    // Also exclude by email — creator might be stored as email in some interactions
    const creatorEmail = suggestion.created_by;

    if (uniqueUserIds.length === 0) {
      console.log('[SUGGESTION AUTOMATION] No users to notify');
      return Response.json({ success: true, notificationsSent: 0 });
    }

    // Fetch users to get their preferredLanguage
    const allUsers = await base44.asServiceRole.entities.User.filter({ id: { $in: uniqueUserIds } });
    // Filter out the creator by email as well
    const users = allUsers.filter(u => u.email !== creatorEmail);

    const isEditSuggestion = suggestion.type === 'edit_suggestion';
    const titleKey = isEditSuggestion ? 'editSuggestionTitle' : 'newSuggestionTitle';
    const messageKey = isEditSuggestion ? 'editSuggestionMessage' : 'newSuggestionMessage';
    const replacements = { name: creatorName, title: document.title };
    const translationsObj = buildTranslations(titleKey, messageKey, replacements);

    const notifications = users.map(user => {
      const userLang = user.preferredLanguage || 'he';
      return {
        userId: user.id,
        type: 'new_suggestion_in_followed_document',
        title: t(userLang, titleKey, replacements),
        message: t(userLang, messageKey, replacements),
        translations: translationsObj,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl: `/suggestiondetail?id=${suggestion.id}`,
        read: false
      };
    });

    await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    console.log('[SUGGESTION AUTOMATION] Created', notifications.length, 'notifications');

    const duration = Date.now() - startTime;
    return Response.json({ success: true, notificationsSent: notifications.length, duration });
  } catch (error) {
    console.error('[SUGGESTION AUTOMATION] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});