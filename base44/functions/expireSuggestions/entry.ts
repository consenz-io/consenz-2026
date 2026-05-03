import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Scheduled handler: expires pending suggestions whose timerEndsAt has passed.
 * For each expired suggestion:
 *  1. Marks it as rejected
 *  2. Notifies the creator and all voters
 *  3. Awards gamification points to con voters (if enabled)
 */

// ─── i18n ─────────────────────────────────────────────────────────────────────
const LANGS = ['en', 'he', 'ar'];

const EXPIRY_T = {
  en: {
    creatorTitle:  "Your suggestion has expired",
    creatorMessage:"\"{title}\" did not receive enough support within the voting period and was rejected.",
    voterTitle:    "A suggestion you voted on has expired",
    voterMessage:  "\"{title}\" did not receive enough support within the voting period and was rejected.",
  },
  he: {
    creatorTitle:  "ההצעה שלך פגה תוקף",
    creatorMessage:"\"{title}\" לא קיבלה מספיק תמיכה בזמן הקצוב ונדחתה.",
    voterTitle:    "הצעה שהצבעת עליה פגה תוקף",
    voterMessage:  "\"{title}\" לא קיבלה מספיק תמיכה בזמן הקצוב ונדחתה.",
  },
  ar: {
    creatorTitle:  "انتهت صلاحية اقتراحك",
    creatorMessage:"لم يحصل \"{title}\" على دعم كافٍ خلال فترة التصويت وتم رفضه.",
    voterTitle:    "انتهت صلاحية اقتراح صوّتَ عليه",
    voterMessage:  "لم يحصل \"{title}\" على دعم كافٍ خلال فترة التصويت وتم رفضه.",
  }
};

function translate(lang, key, replacements = {}) {
  let text = EXPIRY_T[lang]?.[key] || EXPIRY_T['he'][key] || key;
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

// ─── Process one expired suggestion ───────────────────────────────────────────
async function processExpiredSuggestion(base44, suggestion, allProfiles) {
  const [, votes] = await Promise.all([
    base44.asServiceRole.entities.Suggestion.update(suggestion.id, { status: 'rejected', rejectedByAdmin: false }),
    base44.asServiceRole.entities.Vote.filter({ suggestionId: suggestion.id })
  ]);

  // Collect unique recipient userIds
  const recipientUserIds = new Set();
  if (suggestion.created_by) {
    const creatorProfile = allProfiles.find(p => p.email === suggestion.created_by);
    if (creatorProfile?.userId) recipientUserIds.add(creatorProfile.userId);
  }
  votes.forEach(v => { if (v.userId) recipientUserIds.add(v.userId); });

  // Build notifications
  const replacements = { title: suggestion.title || 'הצעה' };
  const notifications = [];
  for (const userId of recipientUserIds) {
    const profile   = allProfiles.find(p => p.userId === userId);
    const isCreator = profile?.email === suggestion.created_by;
    const titleKey   = isCreator ? 'creatorTitle'   : 'voterTitle';
    const messageKey = isCreator ? 'creatorMessage' : 'voterMessage';
    notifications.push({
      userId,
      type:              'suggestion_expiring',
      title:             translate('he', titleKey,   replacements),
      message:           translate('he', messageKey, replacements),
      translations:      buildAllTranslations(titleKey, messageKey, replacements),
      relatedEntityId:   suggestion.id,
      relatedEntityType: 'suggestion',
      read:              false,
      actionUrl:         `/suggestiondetail?id=${suggestion.id}`
    });
  }
  if (notifications.length > 0) {
    await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
  }

  // Gamification: award con voters if enabled
  try {
    const documents = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId });
    const document  = documents[0];
    if (document?.gamificationEnabled) {
      const conVoterIdSet = new Set(votes.filter(v => v.vote === 'con').map(v => v.userId).filter(Boolean));
      if (conVoterIdSet.size > 0) {
        const allSystemUsers  = await base44.asServiceRole.entities.User.list();
        const conVoterUsers   = allSystemUsers.filter(u => conVoterIdSet.has(u.id));
        for (const u of conVoterUsers) {
          await Promise.all([
            base44.asServiceRole.entities.User.update(u.id, { points: (u.points || 1000) + 50 }),
            base44.asServiceRole.entities.PointsTransaction.create({
              userId:            u.id,
              amount:            50,
              action:            'vote_influenced_acceptance',
              description:       `הצבעתך השפיעה על דחיית ההצעה: ${suggestion.title || 'הצעה'}`,
              relatedEntityId:   suggestion.id,
              relatedEntityType: 'suggestion'
            })
          ]);
        }
        console.log('[EXPIRE SUGGESTIONS] ✓ Awarded 50 points to', conVoterUsers.length, 'con voters');
      }
    }
  } catch (pointsErr) {
    console.error('[EXPIRE SUGGESTIONS] Points award failed (non-critical):', pointsErr.message);
  }

  console.log('[EXPIRE SUGGESTIONS] Done:', suggestion.id, '— notified', recipientUserIds.size);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    console.log('[EXPIRE SUGGESTIONS] Running at:', new Date().toISOString());

    const pendingSuggestions = await base44.asServiceRole.entities.Suggestion.filter({ status: 'pending' });
    const expired = pendingSuggestions.filter(s => s.timerEndsAt && new Date(s.timerEndsAt) <= new Date());

    console.log('[EXPIRE SUGGESTIONS] Total pending:', pendingSuggestions.length, '| Expired:', expired.length);
    if (expired.length === 0) return Response.json({ success: true, expired: 0 });

    // Fetch profiles once — shared across all suggestions in this batch
    const allProfiles = await base44.asServiceRole.entities.UserPublicProfile.list();

    // Process sequentially to avoid quota bursts
    for (const suggestion of expired) {
      console.log('[EXPIRE SUGGESTIONS] Expiring:', suggestion.id, suggestion.title);
      await processExpiredSuggestion(base44, suggestion, allProfiles);
    }

    return Response.json({ success: true, expired: expired.length });
  } catch (error) {
    console.error('[EXPIRE SUGGESTIONS ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});