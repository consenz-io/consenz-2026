import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TRANSLATIONS = {
  en: {
    notifRejectedTitle: "Your suggestion was rejected",
    notifRejectedMessage: "The suggestion \"{title}\" was rejected by the document admin",
  },
  he: {
    notifRejectedTitle: "ההצעה שלך נדחתה",
    notifRejectedMessage: "ההצעה \"{title}\" נדחתה על ידי מנהל המסמך",
  },
  ar: {
    notifRejectedTitle: "تم رفض اقتراحك",
    notifRejectedMessage: "تم رفض الاقتراح \"{title}\" من قبل مدير المستند",
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
    const { event, data: suggestion, old_data: oldSuggestion } = await req.json();

    if (!suggestion || event.type !== 'update') {
      return Response.json({ message: 'Not an update event' }, { status: 200 });
    }

    // בדיקה אם הסטטוס השתנה
    const statusChanged = oldSuggestion?.status !== suggestion.status;
    if (!statusChanged) {
      console.log('[AUTOMATION] Status not changed, skipping');
      return Response.json({ message: 'Status not changed' }, { status: 200 });
    }

    console.log('[AUTOMATION] Suggestion status changed:', suggestion.id, oldSuggestion.status, '->', suggestion.status);

    // קבלת המסמך
    const document = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }).then(d => d[0]);
    if (!document) {
      console.log('[AUTOMATION] Document not found');
      return Response.json({ message: 'Document not found' }, { status: 200 });
    }

    // אם הצעה אושרה על ידי אדמין (לא דרך הצבעות) - עדכן מד קונסנזוס רק להצעות שעברו את רף ההצבעות
    // הצעות שאושרו על ידי אדמין מסומנות עם approvedByAdmin=true ולא משפיעות על המד
    if (suggestion.status === 'accepted' && suggestion.approvedByAdmin === true) {
      console.log('[AUTOMATION] Suggestion approved by admin override - skipping consensus meter update');
    } else if (suggestion.status === 'accepted' && !suggestion.approvedByAdmin) {
      // הצעה שהגיעה לסטטוס accepted ללא סימון approvedByAdmin -
      // כלומר אושרה דרך processAcceptance או autoAcceptSuggestion (עברה הצבעות)
      // החישוב כבר בוצע שם, אין צורך לעשות כלום כאן
      console.log('[AUTOMATION] Suggestion accepted via vote threshold - consensus already updated by processAcceptance');
    }

    // Accepted suggestions: notification is already sent by processAcceptance.
    // This automation only handles rejected suggestions (admin override).
    if (suggestion.status === 'accepted') {
      console.log('[AUTOMATION] Accepted - notification already sent by processAcceptance, skipping');
      return Response.json({ message: 'Accepted notifications handled by processAcceptance' }, { status: 200 });
    }

    if (suggestion.status !== 'rejected') {
      return Response.json({ message: 'Status not rejected, skipping' }, { status: 200 });
    }

    // שליחת התראה רק על דחייה על ידי אדמין (לא על פקיעת תוקף)
    // פקיעת תוקף מסומנת עם rejectedByAdmin: false ושולחת התראה משלה ב-expireSuggestions
    if (suggestion.rejectedByAdmin !== true) {
      console.log('[AUTOMATION] Suggestion rejected by expiry (not admin) - notification already sent by expireSuggestions, skipping');
      return Response.json({ message: 'Expiry rejection - notification handled by expireSuggestions' }, { status: 200 });
    }

    const creatorUser = await base44.asServiceRole.entities.User.filter({ email: suggestion.created_by }).then(u => u[0]);
    if (!creatorUser) {
      console.log('[AUTOMATION] Creator not found');
      return Response.json({ message: 'Creator not found' }, { status: 200 });
    }

    const userLang = creatorUser.preferredLanguage || 'he';
    const replacements = { title: suggestion.title || '' };
    await base44.asServiceRole.entities.Notification.create({
      userId: creatorUser.id,
      type: 'suggestion_rejected',
      title: t(userLang, 'notifRejectedTitle', replacements),
      message: t(userLang, 'notifRejectedMessage', replacements),
      translations: buildTranslations('notifRejectedTitle', 'notifRejectedMessage', replacements),
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: `/suggestiondetail?id=${suggestion.id}`
    });

    console.log('[AUTOMATION] Rejection notification sent');
    return Response.json({ success: true });
  } catch (error) {
    console.error('[AUTOMATION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});