import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automation handler: fires when a Vote entity is created.
 * Responsibilities:
 *  1. Notify the suggestion creator about the new vote
 *  2. Award gamification points for pro votes
 */

// ─── i18n ─────────────────────────────────────────────────────────────────────
const LANGS = ['en', 'he', 'ar'];

const VOTE_T = {
  en: { voteTitle: "New vote on your suggestion",     voteMessage: "Someone voted {direction} on your suggestion \"{title}\"" },
  he: { voteTitle: "הצבעה חדשה על ההצעה שלך",          voteMessage: "מישהו הצביע {direction} על ההצעה \"{title}\"" },
  ar: { voteTitle: "تصويت جديد على اقتراحك",             voteMessage: "صوّت شخص ما {direction} على اقتراحك \"{title}\"" }
};

const DIRECTION = {
  en: { pro: 'in favour', con: 'against' },
  he: { pro: 'בעד',        con: 'נגד' },
  ar: { pro: 'مع',         con: 'ضد' }
};

function translate(lang, key, replacements = {}) {
  let text = VOTE_T[lang]?.[key] || VOTE_T['he'][key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return text;
}

function buildAllTranslations(voteType, title) {
  const result = {};
  for (const lang of LANGS) {
    const replacements = { title, direction: DIRECTION[lang]?.[voteType] || voteType };
    result[lang] = {
      title:   translate(lang, 'voteTitle',   replacements),
      message: translate(lang, 'voteMessage', replacements),
    };
  }
  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: vote } = await req.json();

    if (!vote || event.type !== 'create') {
      return Response.json({ message: 'Not a create event' });
    }

    console.log('[VOTE AUTOMATION] Processing new vote:', vote.id, 'on suggestion:', vote.suggestionId);

    const suggestions = await base44.asServiceRole.entities.Suggestion.filter({ id: vote.suggestionId });
    const suggestion  = suggestions[0];
    if (!suggestion) return Response.json({ message: 'Suggestion not found - skipping' });

    const [documents, creatorUsers] = await Promise.all([
      base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }),
      base44.asServiceRole.entities.User.filter({ email: suggestion.created_by }),
    ]);

    const document = documents[0];
    const creator  = creatorUsers[0];

    if (!document) return Response.json({ message: 'Document not found - skipping' });
    if (!creator)  return Response.json({ message: 'Creator not found - skipping' });

    // Self-votes produce no notification
    if (vote.userId === creator.id) return Response.json({ message: 'Voter is creator' });

    // ── Notify creator ────────────────────────────────────────────────────────
    try {
      const lang         = creator.preferredLanguage || 'he';
      const direction    = DIRECTION[lang]?.[vote.vote] || vote.vote;
      const replacements = { title: suggestion.title || '', direction };
      await base44.asServiceRole.entities.Notification.create({
        userId:            creator.id,
        type:              'vote_on_suggestion',
        title:             translate(lang, 'voteTitle',   replacements),
        message:           translate(lang, 'voteMessage', replacements),
        translations:      buildAllTranslations(vote.vote, suggestion.title || ''),
        relatedEntityId:   suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl:         `/suggestiondetail?id=${suggestion.id}`,
        read:              false
      });
      console.log('[VOTE AUTOMATION] ✅ Sent vote notification to creator');
    } catch (notifError) {
      console.error('[VOTE AUTOMATION] Notification error (non-critical):', notifError.message);
    }

    // ── Gamification ──────────────────────────────────────────────────────────
    if (document.gamificationEnabled && vote.vote === 'pro') {
      try {
        await Promise.all([
          base44.asServiceRole.entities.User.update(creator.id, { points: (creator.points || 1000) + 10 }),
          base44.asServiceRole.entities.PointsTransaction.create({
            userId:            creator.id,
            amount:            10,
            action:            'vote_received',
            description:       `קיבל הצבעה בעד על ההצעה: ${suggestion.title}`,
            relatedEntityId:   suggestion.id,
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