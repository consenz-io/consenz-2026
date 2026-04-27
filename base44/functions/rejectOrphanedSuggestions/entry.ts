import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TRANSLATIONS = {
  en: {
    rejectedTitle: "Your suggestion was rejected",
    rejectedMessage: "The suggestion \"{title}\" was rejected because the section it referenced no longer exists",
  },
  he: {
    rejectedTitle: "ההצעה שלך נדחתה",
    rejectedMessage: "ההצעה \"{title}\" נדחתה מכיוון שהסעיף אליו היא התייחסה הוסר",
  },
  ar: {
    rejectedTitle: "تم رفض اقتراحك",
    rejectedMessage: "تم رفض الاقتراح \"{title}\" لأن القسم المرتبط به لم يعد موجوداً",
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

    // sectionIds: array of section IDs that were deleted
    // documentId: the document these sections belong to
    // gamificationEnabled: whether to award points
    const { sectionIds, documentId, gamificationEnabled } = await req.json();

    if (!sectionIds || sectionIds.length === 0 || !documentId) {
      return Response.json({ success: true, message: 'No sectionIds provided' });
    }

    console.log('[REJECT ORPHANED] Checking orphaned suggestions for sections:', sectionIds);

    // Find all pending suggestions targeting these sections
    const orphanedSuggestions = await base44.asServiceRole.entities.Suggestion.filter({
      documentId,
      status: 'pending',
      sectionId: { $in: sectionIds }
    });

    if (orphanedSuggestions.length === 0) {
      console.log('[REJECT ORPHANED] No orphaned suggestions found');
      return Response.json({ success: true, rejected: 0 });
    }

    console.log('[REJECT ORPHANED] Found', orphanedSuggestions.length, 'orphaned suggestions');

    // Reject all orphaned suggestions
    await Promise.all(
      orphanedSuggestions.map(s =>
        base44.asServiceRole.entities.Suggestion.update(s.id, {
          status: 'rejected',
          rejectedByAdmin: false // rejected due to section deletion, not admin action
        })
      )
    );

    // Send rejection notifications and award con-voter points
    for (const suggestion of orphanedSuggestions) {
      const replacements = { title: suggestion.title || '' };

      // Notify the creator
      const creatorUsers = await base44.asServiceRole.entities.User.filter({ email: suggestion.created_by });
      const creator = creatorUsers[0];
      if (creator) {
        const userLang = creator.preferredLanguage || 'he';
        await base44.asServiceRole.entities.Notification.create({
          userId: creator.id,
          type: 'suggestion_rejected',
          title: t(userLang, 'rejectedTitle', replacements),
          message: t(userLang, 'rejectedMessage', replacements),
          translations: buildTranslations('rejectedTitle', 'rejectedMessage', replacements),
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl: `/suggestiondetail?id=${suggestion.id}`
        });
      }

      // Award 50 points to con-voters if gamification is enabled
      if (gamificationEnabled) {
        const conVotes = await base44.asServiceRole.entities.Vote.filter({
          suggestionId: suggestion.id,
          vote: 'con'
        });

        for (const vote of conVotes) {
          const voterUsers = await base44.asServiceRole.entities.User.filter({ id: vote.userId });
          const voter = voterUsers[0];
          if (!voter) continue;

          const newPoints = (voter.points || 1000) + 50;
          await Promise.all([
            base44.asServiceRole.entities.User.update(voter.id, { points: newPoints }),
            base44.asServiceRole.entities.PointsTransaction.create({
              userId: voter.id,
              amount: 50,
              action: 'vote_influenced_acceptance',
              description: `הצעה שהצבעת נגדה נדחתה: ${suggestion.title || ''}`,
              relatedEntityId: suggestion.id,
              relatedEntityType: 'suggestion'
            })
          ]);
        }
      }
    }

    console.log('[REJECT ORPHANED] Done. Rejected:', orphanedSuggestions.length);
    return Response.json({ success: true, rejected: orphanedSuggestions.length });

  } catch (error) {
    console.error('[REJECT ORPHANED ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});