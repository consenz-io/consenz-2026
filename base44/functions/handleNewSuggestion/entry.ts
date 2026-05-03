import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automation handler: fires when a Suggestion entity is created.
 * Notifies all users who have previously interacted with the document.
 */

// ─── i18n ─────────────────────────────────────────────────────────────────────
const LANGS = ['en', 'he', 'ar'];

const SUGGESTION_T = {
  en: {
    newSuggestionTitle:   "New suggestion in document",
    newSuggestionMessage: "{name} added a new suggestion in the document \"{title}\"",
    editSuggestionTitle:  "Suggestion to edit a suggestion",
    editSuggestionMessage:"{name} suggested an edit to a suggestion in document \"{title}\"",
  },
  he: {
    newSuggestionTitle:   "הצעה חדשה במסמך",
    newSuggestionMessage: "{name} הוסיף הצעה חדשה במסמך \"{title}\"",
    editSuggestionTitle:  "הצעה לעריכת הצעה",
    editSuggestionMessage:"{name} הציע/ה עריכה להצעה במסמך \"{title}\"",
  },
  ar: {
    newSuggestionTitle:   "اقتراح جديد في المستند",
    newSuggestionMessage: "{name} أضاف اقتراحًا جديدًا في المستند \"{title}\"",
    editSuggestionTitle:  "اقتراح لتعديل اقتراح",
    editSuggestionMessage:"{name} اقترح تعديلاً على اقتراح في المستند \"{title}\"",
  }
};

function translate(lang, key, replacements = {}) {
  let text = SUGGESTION_T[lang]?.[key] || SUGGESTION_T['he'][key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return text;
}

function buildAllTranslations(titleKey, messageKey, replacements = {}) {
  const result = {};
  for (const lang of LANGS) {
    result[lang] = { title: translate(lang, titleKey, replacements), message: translate(lang, messageKey, replacements) };
  }
  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: suggestion } = await req.json();

    if (!suggestion || event.type !== 'create') {
      return Response.json({ message: 'Not a create event' });
    }

    console.log('[SUGGESTION AUTOMATION] Processing new suggestion:', suggestion.id);

    const [documents, interactions, creatorProfiles] = await Promise.all([
      base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }),
      base44.asServiceRole.entities.UserInteraction.filter({ documentId: suggestion.documentId }),
      base44.asServiceRole.entities.UserPublicProfile.filter({ email: suggestion.created_by })
    ]);

    const document = documents[0];
    if (!document) return Response.json({ message: 'Document not found' }, { status: 404 });

    const creatorName = creatorProfiles[0]?.fullName || 'User';

    // Exclude the creator themselves from the notification list
    const uniqueUserIds = [...new Set(interactions.map(i => i.userId))].filter(uid => uid !== suggestion.created_by);
    if (uniqueUserIds.length === 0) {
      return Response.json({ success: true, notificationsSent: 0 });
    }

    // $in not supported — fetch all and filter client-side
    const allUsers = await base44.asServiceRole.entities.User.list();
    const recipients = allUsers.filter(u => uniqueUserIds.includes(u.id));

    const isEditSuggestion = suggestion.type === 'edit_suggestion';
    const titleKey   = isEditSuggestion ? 'editSuggestionTitle'   : 'newSuggestionTitle';
    const messageKey = isEditSuggestion ? 'editSuggestionMessage' : 'newSuggestionMessage';
    const replacements    = { name: creatorName, title: document.title };
    const allTranslations = buildAllTranslations(titleKey, messageKey, replacements);

    const notifications = recipients.map(user => {
      const lang = user.preferredLanguage || 'he';
      return {
        userId:            user.id,
        type:              'new_suggestion_in_followed_document',
        title:             translate(lang, titleKey,   replacements),
        message:           translate(lang, messageKey, replacements),
        translations:      allTranslations,
        relatedEntityId:   suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl:         `/suggestiondetail?id=${suggestion.id}`,
        read:              false
      };
    });

    await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    console.log('[SUGGESTION AUTOMATION] Created', notifications.length, 'notifications');

    return Response.json({ success: true, notificationsSent: notifications.length, duration: Date.now() - startTime });
  } catch (error) {
    console.error('[SUGGESTION AUTOMATION] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});