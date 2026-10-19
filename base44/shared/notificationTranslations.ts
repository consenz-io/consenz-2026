/**
 * Shared notification translation utilities.
 *
 * All backend functions that create Notifications use this module to build
 * the pre-computed `translations` object ({ en, he, ar }) stored on each
 * Notification record.  This replaces the per-function duplicated
 * TRANSLATIONS / t / buildTranslations code.
 *
 * Usage:
 *   import { buildTranslations } from '../../shared/notificationTranslations.ts';
 *   const translations = buildTranslations('creatorTitle', 'creatorMessage', { title: suggestion.title });
 */

const NOTIFICATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    // handleNewComment
    replyTitle: "Reply to your comment",
    replyMessage: "{name} replied to your comment",
    suggestionCommentTitle: "New comment on your suggestion",
    suggestionCommentMessage: "{name} commented on your suggestion",
    sectionCommentTitle: "New comment on your section",
    sectionCommentMessage: "{name} commented on your section",
    documentCommentTitle: "New comment on the document",
    documentCommentMessage: "{name} commented on the document",
    // handleNewSuggestion
    newSuggestionTitle: "New suggestion in document",
    newSuggestionMessage: "{name} added a new suggestion in the document \"{title}\"",
    editSuggestionTitle: "Suggestion to edit a suggestion",
    editSuggestionMessage: "{name} suggested an edit to a suggestion in document \"{title}\"",
    // voteOnSection / voteOnSectionV2
    sectionDeletedTitle: "A section was removed from the document",
    sectionDeletedMessage: "A section in the document \"{title}\" was removed by community vote",
    // rejectOrphanedSuggestions
    rejectedTitle: "Your suggestion was rejected",
    rejectedMessage: "The suggestion \"{title}\" was rejected because the section it referenced no longer exists",
    // processAcceptance V1-V4
    creatorTitle: "🎉 Your suggestion was accepted!",
    creatorMessage: "The suggestion \"{title}\" was accepted and added to the document",
    participantTitle: "A suggestion was accepted in the document",
    participantMessage: "The suggestion \"{title}\" was accepted in the document \"{doc}\"",
    // manageGroupMembership
    groupJoinApprovedTitle: "Join request approved!",
    groupJoinApprovedMessage: "You have been accepted to the group \"{groupName}\"",
    // sendMessage
    directMessageTitle: "New message from {name}",
    // applyAdminEdit — direct admin edits (no consensus impact)
    adminEditSectionTitle: "Section edited by admin",
    adminEditSectionMessage: "{name} edited a section in the document \"{doc}\"",
    adminNewSectionTitle: "New section added by admin",
    adminNewSectionMessage: "{name} added a new section in the document \"{doc}\"",
    adminDeleteSectionTitle: "Section deleted by admin",
    adminDeleteSectionMessage: "{name} deleted a section in the document \"{doc}\"",
    adminEditTopicTitle: "Topic title changed by admin",
    adminEditTopicMessage: "{name} changed a topic title in the document \"{doc}\"",
    // Group admin activity notifications
    adminVoteTitle: "New vote in your group's document",
    adminVoteMessage: "{name} voted on a suggestion in \"{doc}\"",
    adminCommentTitle: "New comment in your group's document",
    adminCommentMessage: "{name} commented in \"{doc}\"",
    adminSuggestionTitle: "New suggestion in your group's document",
    adminSuggestionMessage: "{name} added a suggestion in \"{doc}\"",
    adminAcceptanceTitle: "Suggestion accepted in your group's document",
    adminAcceptanceMessage: "The suggestion \"{title}\" was accepted in \"{doc}\"",
    adminSectionDeletedTitle: "Section removed in your group's document",
    adminSectionDeletedMessage: "A section was removed by community vote in \"{doc}\"",
    adminNewParticipantTitle: "New participant in your group's document",
    adminNewParticipantMessage: "{name} joined the document \"{doc}\"",
    // notifySuggestionReopened — admin returns an expired/rejected suggestion to voting
    suggestionReopenedTitle: "Suggestion returned to voting",
    suggestionReopenedMessage: "The suggestion \"{title}\" was returned to voting by the document admin",
  },
  he: {
    replyTitle: "תשובה לתגובה שלך",
    replyMessage: "{name} השיב לתגובה שלך",
    suggestionCommentTitle: "תגובה חדשה על ההצעה שלך",
    suggestionCommentMessage: "{name} הגיב על ההצעה שלך",
    sectionCommentTitle: "תגובה חדשה על הסעיף שלך",
    sectionCommentMessage: "{name} הגיב על הסעיף שלך",
    documentCommentTitle: "תגובה חדשה על המסמך",
    documentCommentMessage: "{name} הגיב/ה על המסמך",
    newSuggestionTitle: "הצעה חדשה במסמך",
    newSuggestionMessage: "{name} הוסיף הצעה חדשה במסמך \"{title}\"",
    editSuggestionTitle: "הצעה לעריכת הצעה",
    editSuggestionMessage: "{name} הציע/ה עריכה להצעה במסמך \"{title}\"",
    sectionDeletedTitle: "סעיף הוסר מהמסמך",
    sectionDeletedMessage: "סעיף במסמך \"{title}\" הוסר בהצבעת קהילה",
    rejectedTitle: "ההצעה שלך נדחתה",
    rejectedMessage: "ההצעה \"{title}\" נדחתה מכיוון שהסעיף אליו היא התייחסה הוסר",
    creatorTitle: "🎉 ההצעה שלך התקבלה!",
    creatorMessage: "ההצעה \"{title}\" התקבלה ונוספה למסמך",
    participantTitle: "הצעה התקבלה במסמך",
    participantMessage: "ההצעה \"{title}\" התקבלה במסמך \"{doc}\"",
    groupJoinApprovedTitle: "בקשת ההצרפות אושרה!",
    groupJoinApprovedMessage: "התקבלת לקבוצה \"{groupName}\"",
    directMessageTitle: "הודעה חדשה מ{name}",
    // עריכות אדמין ישירות — ללא השפעה על מד הקונצנזוס
    adminEditSectionTitle: "סעיף נערך על ידי מנהל",
    adminEditSectionMessage: "{name} ערך/ה סעיף במסמך \"{doc}\"",
    adminNewSectionTitle: "סעיף חדש נוסף על ידי מנהל",
    adminNewSectionMessage: "{name} הוסיפ/ה סעיף חדש במסמך \"{doc}\"",
    adminDeleteSectionTitle: "סעיף נמחק על ידי מנהל",
    adminDeleteSectionMessage: "{name} מחק/ה סעיף במסמך \"{doc}\"",
    adminEditTopicTitle: "כותרת נושא שונתה על ידי מנהל",
    adminEditTopicMessage: "{name} שינה/ה כותרת נושא במסמך \"{doc}\"",
    // נוטיפיקציות פעילות לאדמין קבוצה
    adminVoteTitle: "הצבעה חדשה במסמך בקבוצה שלך",
    adminVoteMessage: "{name} הצביע/ה על הצעה במסמך \"{doc}\"",
    adminCommentTitle: "תגובה חדשה במסמך בקבוצה שלך",
    adminCommentMessage: "{name} הגיב/ה במסמך \"{doc}\"",
    adminSuggestionTitle: "הצעה חדשה במסמך בקבוצה שלך",
    adminSuggestionMessage: "{name} הוסיף/ה הצעה במסמך \"{doc}\"",
    adminAcceptanceTitle: "הצעה התקבלה במסמך בקבוצה שלך",
    adminAcceptanceMessage: "ההצעה \"{title}\" התקבלה במסמך \"{doc}\"",
    adminSectionDeletedTitle: "סעיף הוסר במסמך בקבוצה שלך",
    adminSectionDeletedMessage: "סעיף הוסר בהצבעת קהילה במסמך \"{doc}\"",
    adminNewParticipantTitle: "משתתף חדש במסמך בקבוצה שלך",
    adminNewParticipantMessage: "{name} הצטרף/ה למסמך \"{doc}\"",
    suggestionReopenedTitle: "הצעה חזרה להצבעה",
    suggestionReopenedMessage: "ההצעה \"{title}\" הוחזרה להצבעה על ידי מנהל המסמך",
  },
  ar: {
    replyTitle: "رد على تعليقك",
    replyMessage: "{name} رد على تعليقك",
    suggestionCommentTitle: "تعليق جديد على اقتراحك",
    suggestionCommentMessage: "{name} علق على اقتراحك",
    sectionCommentTitle: "تعليق جديد على قسمك",
    sectionCommentMessage: "{name} علق على قسمك",
    documentCommentTitle: "تعليق جديد على المستند",
    documentCommentMessage: "{name} علق على المستند",
    newSuggestionTitle: "اقتراح جديد في المستند",
    newSuggestionMessage: "{name} أضاف اقتراحًا جديدًا في المستند \"{title}\"",
    editSuggestionTitle: "اقتراح لتعديل اقتراح",
    editSuggestionMessage: "{name} اقترح تعديلاً على اقتراح في المستند \"{title}\"",
    sectionDeletedTitle: "تمت إزالة بند من الوثيقة",
    sectionDeletedMessage: "تمت إزالة بند في الوثيقة \"{title}\" بتصويت المجتمع",
    rejectedTitle: "تم رفض اقتراحك",
    rejectedMessage: "تم رفض الاقتراح \"{title}\" لأن القسم المرتبط به لم يعد موجوداً",
    creatorTitle: "🎉 تم قبول اقتراحك!",
    creatorMessage: "تم قبول الاقتراح \"{title}\" وإضافته إلى المستند",
    participantTitle: "تم قبول اقتراح في المستند",
    participantMessage: "تم قبول الاقتراح \"{title}\" في المستند \"{doc}\"",
    groupJoinApprovedTitle: "تمت الموافقة على طلب الانضمام!",
    groupJoinApprovedMessage: "تم قبولك في المجموعة \"{groupName}\"",
    directMessageTitle: "رسالة جديدة من {name}",
    // تعديلات المسؤول المباشرة — دون التأثير على مقياس الإجماع
    adminEditSectionTitle: "تم تعديل قسم بواسطة المشرف",
    adminEditSectionMessage: "{name} عدّل قسماً في المستند \"{doc}\"",
    adminNewSectionTitle: "تمت إضافة قسم جديد بواسطة المشرف",
    adminNewSectionMessage: "{name} أضاف قسماً جديداً في المستند \"{doc}\"",
    adminDeleteSectionTitle: "تم حذف قسم بواسطة المشرف",
    adminDeleteSectionMessage: "{name} حذف قسماً في المستند \"{doc}\"",
    adminEditTopicTitle: "تم تغيير عنوان الموضوع بواسطة المشرف",
    adminEditTopicMessage: "{name} غيّر عنوان موضوع في المستند \"{doc}\"",
    // إشعارات نشاط المشرف للمجموعة
    adminVoteTitle: "تصويت جديد في مستند مجموعتك",
    adminVoteMessage: "{name} صوّت على اقتراح في المستند \"{doc}\"",
    adminCommentTitle: "تعليق جديد في مستند مجموعتك",
    adminCommentMessage: "{name} علق في المستند \"{doc}\"",
    adminSuggestionTitle: "اقتراح جديد في مستند مجموعتك",
    adminSuggestionMessage: "{name} أضاف اقتراحًا في المستند \"{doc}\"",
    adminAcceptanceTitle: "تم قبول اقتراح في مستند مجموعتك",
    adminAcceptanceMessage: "تم قبول الاقتراح \"{title}\" في المستند \"{doc}\"",
    adminSectionDeletedTitle: "تمت إزالة بند في مستند مجموعتك",
    adminSectionDeletedMessage: "تمت إزالة بند بتصويت المجتمع في المستند \"{doc}\"",
    adminNewParticipantTitle: "مشارك جديد في مستند مجموعتك",
    adminNewParticipantMessage: "{name} انضم إلى المستند \"{doc}\"",
    suggestionReopenedTitle: "عاد الاقتراح إلى التصويت",
    suggestionReopenedMessage: "تمت إعادة الاقتراح \"{title}\" إلى التصويت من قبل مدير المستند",
  },
};

const LANGUAGES = ['en', 'he', 'ar'] as const;

export function t(lang: string, key: string, replacements: Record<string, string> = {}): string {
  let text = NOTIFICATION_TRANSLATIONS[lang]?.[key] || NOTIFICATION_TRANSLATIONS['he'][key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return text;
}

/**
 * Build a translations object for a Notification: { en: {title, message}, he: {...}, ar: {...} }.
 * Both titleKey and messageKey are looked up in NOTIFICATION_TRANSLATIONS.
 */
export function buildTranslations(
  titleKey: string,
  messageKey: string,
  replacements: Record<string, string> = {},
): Record<string, { title: string; message: string }> {
  const result: Record<string, { title: string; message: string }> = {};
  for (const lang of LANGUAGES) {
    result[lang] = {
      title: t(lang, titleKey, replacements),
      message: t(lang, messageKey, replacements),
    };
  }
  return result;
}

/**
 * Build a translations object where only the title is translated and the
 * message is the same across all languages (e.g. user-generated content
 * like a direct-message preview).
 */
export function buildTranslationsWithMessage(
  titleKey: string,
  message: string,
  replacements: Record<string, string> = {},
): Record<string, { title: string; message: string }> {
  const result: Record<string, { title: string; message: string }> = {};
  for (const lang of LANGUAGES) {
    result[lang] = {
      title: t(lang, titleKey, replacements),
      message,
    };
  }
  return result;
}