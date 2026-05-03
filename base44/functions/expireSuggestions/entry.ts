import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const EXPIRY_TRANSLATIONS = {
  en: {
    creatorTitle: "Your suggestion has expired",
    creatorMessage: "\"{title}\" did not receive enough support within the voting period and was rejected.",
    voterTitle: "A suggestion you voted on has expired",
    voterMessage: "\"{title}\" did not receive enough support within the voting period and was rejected.",
  },
  he: {
    creatorTitle: "ההצעה שלך פגה תוקף",
    creatorMessage: "\"{title}\" לא קיבלה מספיק תמיכה בזמן הקצוב ונדחתה.",
    voterTitle: "הצעה שהצבעת עליה פגה תוקף",
    voterMessage: "\"{title}\" לא קיבלה מספיק תמיכה בזמן הקצוב ונדחתה.",
  },
  ar: {
    creatorTitle: "انتهت صلاحية اقتراحك",
    creatorMessage: "لم يحصل \"{title}\" على دعم كافٍ خلال فترة التصويت وتم رفضه.",
    voterTitle: "انتهت صلاحية اقتراح صوّتَ عليه",
    voterMessage: "لم يحصل \"{title}\" على دعم كافٍ خلال فترة التصويت وتم رفضه.",
  }
};

function expiryT(lang, key, replacements = {}) {
  let text = EXPIRY_TRANSLATIONS[lang]?.[key] || EXPIRY_TRANSLATIONS['he'][key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

function buildExpiryTranslations(titleKey, messageKey, replacements = {}) {
  const result = {};
  for (const lang of ['en', 'he', 'ar']) {
    result[lang] = {
      title: expiryT(lang, titleKey, replacements),
      message: expiryT(lang, messageKey, replacements),
    };
  }
  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();
    console.log('[EXPIRE SUGGESTIONS] Running at:', now);

    const pendingSuggestions = await base44.asServiceRole.entities.Suggestion.filter({ status: 'pending' });
    console.log('[EXPIRE SUGGESTIONS] Total pending:', pendingSuggestions.length);

    const expired = pendingSuggestions.filter(s => s.timerEndsAt && new Date(s.timerEndsAt) <= new Date());
    console.log('[EXPIRE SUGGESTIONS] Expired:', expired.length);

    if (expired.length === 0) {
      return Response.json({ success: true, expired: 0 });
    }

    // Fetch all profiles ONCE outside the loop
    const allProfiles = await base44.asServiceRole.entities.UserPublicProfile.list();

    // Process expired suggestions sequentially to avoid quota burst
    let processedCount = 0;
    for (const suggestion of expired) {
      console.log('[EXPIRE SUGGESTIONS] Expiring:', suggestion.id, suggestion.title);

      // Mark as rejected and fetch votes in parallel (within one suggestion is fine)
      const [, votes] = await Promise.all([
        base44.asServiceRole.entities.Suggestion.update(suggestion.id, { status: 'rejected', rejectedByAdmin: false }),
        base44.asServiceRole.entities.Vote.filter({ suggestionId: suggestion.id })
      ]);

      // Collect recipient userIds
      const recipientUserIds = new Set();

      if (suggestion.created_by) {
        const creatorProfile = allProfiles.find(p => p.email === suggestion.created_by);
        if (creatorProfile?.userId) recipientUserIds.add(creatorProfile.userId);
      }

      votes.forEach(v => { if (v.userId) recipientUserIds.add(v.userId); });

      // Build notifications with full translations for all recipients
      const expiryNotifications = [];
      for (const userId of recipientUserIds) {
        const profile = allProfiles.find(p => p.userId === userId);
        const isCreator = profile?.email === suggestion.created_by;
        const titleKey = isCreator ? 'creatorTitle' : 'voterTitle';
        const messageKey = isCreator ? 'creatorMessage' : 'voterMessage';
        const replacements = { title: suggestion.title || 'הצעה' };
        // Use user's preferred language if available — fall back via profile lookup
        const userLang = 'he'; // profiles don't carry preferredLanguage; default is fine here
        expiryNotifications.push({
          userId,
          type: 'suggestion_expiring',
          title: expiryT(userLang, titleKey, replacements),
          message: expiryT(userLang, messageKey, replacements),
          translations: buildExpiryTranslations(titleKey, messageKey, replacements),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          read: false,
          actionUrl: `/suggestiondetail?id=${suggestion.id}`
        });
      }
      if (expiryNotifications.length > 0) {
        await base44.asServiceRole.entities.Notification.bulkCreate(expiryNotifications);
      }

      console.log('[EXPIRE SUGGESTIONS] Done:', suggestion.id, 'notified', recipientUserIds.size);

      // Award points to con voters if gamification is enabled
      try {
        const documents = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId });
        const document = documents[0];
        if (document?.gamificationEnabled) {
          const conVoterIds = votes.filter(v => v.vote === 'con').map(v => v.userId).filter(Boolean);
          if (conVoterIds.length > 0) {
            const conVoterUsers = await base44.asServiceRole.entities.User.filter({ id: { $in: conVoterIds } });
            for (const u of conVoterUsers) {
              await Promise.all([
                base44.asServiceRole.entities.User.update(u.id, { points: (u.points || 1000) + 50 }),
                base44.asServiceRole.entities.PointsTransaction.create({
                  userId: u.id,
                  amount: 50,
                  action: 'vote_influenced_acceptance',
                  description: `הצבעתך השפיעה על דחיית ההצעה: ${suggestion.title || 'הצעה'}`,
                  relatedEntityId: suggestion.id,
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

      processedCount++;
    }

    return Response.json({ success: true, expired: processedCount });
  } catch (error) {
    console.error('[EXPIRE SUGGESTIONS ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});