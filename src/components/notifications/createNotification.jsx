/**
 * createNotification.js
 *
 * Slim frontend notification helper.
 * Responsibility: admin-rejection notifications only.
 * All other notifications (new comment, new suggestion, suggestion accepted/expired)
 * are handled exclusively by backend automations and functions.
 *
 * Functions still called from UI:
 *   - notifySuggestionStatusChange  → SuggestionSidebar, suggestiondetail (admin reject)
 *
 * Dead exports removed:
 *   - notifyVoteOnSuggestion (was a no-op stub)
 *   - notifyNewSuggestion (handled by handleNewSuggestion automation)
 *   - notifyNewTopicEditSuggestion (handled by handleNewSuggestion automation)
 *   - notifyNewComment (handled by handleNewComment automation)
 *   - notifyNewDocumentComment (handled by handleNewComment automation)
 *   - createNotification (internal helper, not used externally)
 */

import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { PAGE_NAMES } from "@/components/pageNames";
import { showBrowserNotification } from './browserNotifications';

// ─── i18n ──────────────────────────────────────────────────────────────────

const TRANSLATIONS = {
  en: {
    notifRejectedTitle: "Your suggestion was rejected",
    notifRejectedMessage: "The suggestion \"{title}\" was rejected by the document admin",
    notifRejectedWithRefundMessage: "The suggestion \"{title}\" was rejected by the document admin. {points} points have been refunded to your account.",
    notifExpiredTitle: "Suggestion voting period ended",
    notifExpiredMessage: "The voting period for suggestion \"{title}\" has ended",
  },
  he: {
    notifRejectedTitle: "ההצעה שלך נדחתה",
    notifRejectedMessage: "ההצעה \"{title}\" נדחתה על ידי מנהל המסמך",
    notifRejectedWithRefundMessage: "ההצעה \"{title}\" נדחתה על ידי מנהל המסמך. {points} נקודות הוחזרו לחשבונך.",
    notifExpiredTitle: "תקופת ההצבעה הסתיימה",
    notifExpiredMessage: "תקופת ההצבעה על ההצעה \"{title}\" הסתיימה",
  },
  ar: {
    notifRejectedTitle: "تم رفض اقتراحك",
    notifRejectedMessage: "تم رفض الاقتراح \"{title}\" من قبل مدير المستند",
    notifRejectedWithRefundMessage: "تم رفض الاقتراح \"{title}\" من قبل مدير المستند. تم إعادة {points} نقطة إلى حسابك.",
    notifExpiredTitle: "انتهت فترة التصويت",
    notifExpiredMessage: "انتهت فترة التصويت على الاقتراح \"{title}\"",
  }
};

function translate(key, lang, replacements = {}) {
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
      title: translate(titleKey, lang, replacements),
      message: translate(messageKey, lang, replacements),
    };
  }
  return result;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Notify suggestion creator (and document participants if accepted)
 * when an admin manually changes suggestion status.
 *
 * Called from:
 *   - SuggestionSidebar → updateStatusMutation
 *   - suggestiondetail  → updateStatusMutation
 */
export async function notifySuggestionStatusChange({
  suggestion,
  newStatus,
  rejectedByAdmin = true,
  refundAmount = 0
}) {
  if (!suggestion?.id || !suggestion?.created_by) {
    console.warn('[NOTIFY STATUS] Missing required fields, skipping');
    return;
  }

  try {
    const actionUrl = `${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${suggestion.id}`;
    const replacements = { title: suggestion.title || '' };

    // Determine message keys
    const isRejectedWithRefund = newStatus === 'rejected' && rejectedByAdmin && refundAmount > 0;
    const titleKey = newStatus === 'rejected' ? 'notifRejectedTitle' : 'notifExpiredTitle';
    const messageKey = isRejectedWithRefund
      ? 'notifRejectedWithRefundMessage'
      : newStatus === 'rejected'
      ? 'notifRejectedMessage'
      : 'notifExpiredMessage';
    const effectiveReplacements = isRejectedWithRefund
      ? { ...replacements, points: String(refundAmount) }
      : replacements;

    // Fetch creator
    const creators = await base44.entities.User.filter({ email: suggestion.created_by });
    const creator = creators[0];
    if (!creator?.id) {
      console.warn('[NOTIFY STATUS] Creator not found:', suggestion.created_by);
      return;
    }

    const userLang = creator.preferredLanguage || 'he';
    const title = translate(titleKey, userLang, effectiveReplacements);
    const message = translate(messageKey, userLang, effectiveReplacements);

    const notifType = newStatus === 'rejected' && rejectedByAdmin
      ? 'suggestion_rejected'
      : 'suggestion_expiring';

    await base44.entities.Notification.create({
      userId: creator.id,
      type: notifType,
      title,
      message,
      translations: buildTranslations(titleKey, messageKey, effectiveReplacements),
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl,
      read: false,
    });

    // Show browser notification for the current user if they are the creator
    showBrowserNotification({ title, body: message, actionUrl });

    console.log('[NOTIFY STATUS] ✓ Notified creator:', creator.email);
  } catch (error) {
    console.error('[NOTIFY STATUS] Error:', error?.message || error);
    // Don't rethrow — notifications must not break the main action
  }
}