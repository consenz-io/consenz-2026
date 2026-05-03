import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VOTE_TRANSLATIONS = {
  en: {
    voteTitle: "New vote on your suggestion",
    voteMessage: "Someone voted {direction} on your suggestion \"{title}\"",
  },
  he: {
    voteTitle: "הצבעה חדשה על ההצעה שלך",
    voteMessage: "מישהו הצביע {direction} על ההצעה \"{title}\"",
  },
  ar: {
    voteTitle: "تصويت جديد على اقتراحك",
    voteMessage: "صوّت شخص ما {direction} على اقتراحك \"{title}\"",
  }
};

const directionLabels = { en: { pro: 'in favour', con: 'against' }, he: { pro: 'בעד', con: 'נגד' }, ar: { pro: 'مع', con: 'ضد' } };

function voteT(lang, key, replacements = {}) {
  let text = VOTE_TRANSLATIONS[lang]?.[key] || VOTE_TRANSLATIONS['he'][key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

function buildVoteTranslations(titleKey, messageKey, replacements = {}) {
  const result = {};
  for (const lang of ['en', 'he', 'ar']) {
    // Strip internal _* keys before passing to the template substituter
    const { _voteType, ...publicReplacements } = replacements;
    const langReplacements = { ...publicReplacements, direction: directionLabels[lang]?.[_voteType] || publicReplacements.direction };
    result[lang] = {
      title: voteT(lang, titleKey, langReplacements),
      message: voteT(lang, messageKey, langReplacements),
    };
  }
  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: vote } = await req.json();

    if (!vote || event.type !== 'create') {
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    console.log('[VOTE AUTOMATION] Processing new vote:', vote.id, 'on suggestion:', vote.suggestionId);

    // Fetch suggestion by specific ID
    const suggestions = await base44.asServiceRole.entities.Suggestion.filter({ id: vote.suggestionId });
    const suggestion = suggestions[0];
    if (!suggestion) {
      console.log('[VOTE AUTOMATION] Suggestion not found (may have been deleted):', vote.suggestionId);
      return Response.json({ message: 'Suggestion not found - skipping' }, { status: 200 });
    }

    // Fetch document and creator in parallel by specific IDs
    const [documents, creatorUsers] = await Promise.all([
      base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }),
      base44.asServiceRole.entities.User.filter({ email: suggestion.created_by }),
    ]);

    const document = documents[0];
    const creator = creatorUsers[0];

    if (!document) {
      console.log('[VOTE AUTOMATION] Document not found:', suggestion.documentId);
      return Response.json({ message: 'Document not found - skipping' }, { status: 200 });
    }
    if (!creator) {
      console.log('[VOTE AUTOMATION] Creator not found:', suggestion.created_by);
      return Response.json({ message: 'Creator not found - skipping' }, { status: 200 });
    }

    // Skip if voter is the creator
    if (vote.userId === creator.id) {
      console.log('[VOTE AUTOMATION] Voter is creator, skipping');
      return Response.json({ message: 'Voter is creator' }, { status: 200 });
    }

    // Notify suggestion creator about the vote
    try {
      const userLang = creator.preferredLanguage || 'he';
      const direction = directionLabels[userLang]?.[vote.vote] || vote.vote;
      const replacements = { title: suggestion.title || '', direction, _voteType: vote.vote };
      await base44.asServiceRole.entities.Notification.create({
        userId: creator.id,
        type: 'vote_on_suggestion',
        title: voteT(userLang, 'voteTitle', replacements),
        message: voteT(userLang, 'voteMessage', replacements),
        translations: buildVoteTranslations('voteTitle', 'voteMessage', replacements),
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl: `/suggestiondetail?id=${suggestion.id}`,
        read: false
      });
      console.log('[VOTE AUTOMATION] ✅ Sent vote notification to creator');
    } catch (notifError) {
      console.error('[VOTE AUTOMATION] Notification error (non-critical):', notifError.message);
    }

    // Award points if gamification enabled and pro vote
    if (document.gamificationEnabled && vote.vote === 'pro') {
      try {
        await Promise.all([
          base44.asServiceRole.entities.User.update(creator.id, {
            points: (creator.points || 1000) + 10
          }),
          base44.asServiceRole.entities.PointsTransaction.create({
            userId: creator.id,
            amount: 10,
            action: 'vote_received',
            description: `קיבל הצבעה בעד על ההצעה: ${suggestion.title}`,
            relatedEntityId: suggestion.id,
            relatedEntityType: 'suggestion'
          })
        ]);
        console.log('[VOTE AUTOMATION] ✅ Awarded 10 points to creator');
      } catch (pointsError) {
        console.error('[VOTE AUTOMATION] Points error (non-critical):', pointsError.message);
      }
    }

    console.log('[VOTE AUTOMATION] ✅ Done');
    return Response.json({ success: true, voteId: vote.id });
  } catch (error) {
    console.error('[VOTE AUTOMATION] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});