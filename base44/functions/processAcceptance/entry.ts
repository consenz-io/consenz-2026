import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Orchestrates the full acceptance lifecycle for a suggestion.
 *
 * Responsibilities:
 *  1. Guard: verify still pending + threshold still met
 *  2. Atomic lock: mark accepted immediately to prevent double-processing
 *  3. Delegate type-specific document mutations to sub-functions
 *  4. Update document consensus + threshold + pending sibling suggestions
 *  5. Send acceptance notifications to all document contributors
 *  6. Award gamification points
 */

// ─── Notification translations ────────────────────────────────────────────────
const NOTIF_T = {
  en: {
    creatorTitle:      "🎉 Your suggestion was accepted!",
    creatorMessage:    "The suggestion \"{title}\" was accepted and added to the document",
    participantTitle:  "A suggestion was accepted in the document",
    participantMessage:"The suggestion \"{title}\" was accepted in the document \"{doc}\"",
  },
  he: {
    creatorTitle:      "🎉 ההצעה שלך התקבלה!",
    creatorMessage:    "ההצעה \"{title}\" התקבלה ונוספה למסמך",
    participantTitle:  "הצעה התקבלה במסמך",
    participantMessage:"ההצעה \"{title}\" התקבלה במסמך \"{doc}\"",
  },
  ar: {
    creatorTitle:      "🎉 تم قبول اقتراحك!",
    creatorMessage:    "تم قبول الاقتراح \"{title}\" وإضافته إلى المستند",
    participantTitle:  "تم قبول اقتراح في المستند",
    participantMessage:"تم قبول الاقتراح \"{title}\" في المستند \"{doc}\"",
  }
};

function nt(lang, key, replacements = {}) {
  let text = NOTIF_T[lang]?.[key] || NOTIF_T['he'][key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return text;
}

function buildNotifTranslations(titleKey, messageKey, replacements = {}) {
  const result = {};
  for (const lang of ['en', 'he', 'ar']) {
    result[lang] = { title: nt(lang, titleKey, replacements), message: nt(lang, messageKey, replacements) };
  }
  return result;
}

// ─── Contributor collection ───────────────────────────────────────────────────
async function collectContributorEmails(base44, document) {
  const [docSuggestions, docSections, agreements] = await Promise.all([
    base44.asServiceRole.entities.Suggestion.filter({ documentId: document.id }),
    base44.asServiceRole.entities.Section.filter({ documentId: document.id }),
    base44.asServiceRole.entities.DocumentAgreement.filter({ documentId: document.id })
  ]);

  const suggestionIdSet = new Set(docSuggestions.map(s => s.id));
  const sectionIdSet    = new Set(docSections.map(s => s.id));

  const [docVotes, docSuggestionComments, docSectionComments, docDocumentComments] = await Promise.all([
    suggestionIdSet.size > 0
      ? base44.asServiceRole.entities.Vote.filter({ suggestionId: { $in: [...suggestionIdSet] } })
      : Promise.resolve([]),
    suggestionIdSet.size > 0
      ? base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'suggestion', rootEntityId: { $in: [...suggestionIdSet] } })
      : Promise.resolve([]),
    sectionIdSet.size > 0
      ? base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'section', rootEntityId: { $in: [...sectionIdSet] } })
      : Promise.resolve([]),
    base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'document', rootEntityId: document.id }),
  ]);
  const docComments = [...docSuggestionComments, ...docSectionComments, ...docDocumentComments];

  const emails = new Set();
  agreements.forEach(a => { if (a.userEmail) emails.add(a.userEmail); });
  docVotes.forEach(v => { if (v.created_by) emails.add(v.created_by); });
  docComments.forEach(c => { if (c.created_by) emails.add(c.created_by); });
  docSuggestions.forEach(s => { if (s.created_by) emails.add(s.created_by); });
  return emails;
}

// ─── Calculate contributors count (for consensus math) ───────────────────────
async function calculateContributors(base44, documentId) {
  const result = await base44.asServiceRole.functions.invoke('_calculateContributors', { documentId });
  return result?.count ?? 1;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { suggestionId, documentId, voterId, wasNewVote, forceAccept } = await req.json();

    console.log('[PROCESS ACCEPTANCE] Starting for suggestion:', suggestionId);

    const [suggestion, document] = await Promise.all([
      base44.asServiceRole.entities.Suggestion.get(suggestionId),
      base44.asServiceRole.entities.Document.get(documentId)
    ]);

    if (!suggestion || !document) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    if (suggestion.status !== 'pending') {
      return Response.json({ success: true, message: 'Already processed' });
    }

    // Verify threshold still met (skip if forceAccept, e.g. cascaded from edit_suggestion)
    if (!forceAccept) {
      const delta     = (suggestion.proVotes || 0) - (suggestion.conVotes || 0);
      const threshold = document.threshold ? Math.max(1, Math.round(document.threshold)) : 2;
      console.log('[PROCESS ACCEPTANCE] Threshold check:', { delta, threshold, willAccept: delta >= threshold });
      if (delta < threshold) {
        console.log('[PROCESS ACCEPTANCE] Threshold not met, aborting');
        return Response.json({ success: true, message: 'Threshold not met' });
      }
    }

    // ── Atomic lock: write only the lock token (NOT status yet).
    // Then re-read. If another instance wrote a different token in the meantime,
    // bail out. Only the winner then flips status to 'accepted' AFTER all mutations succeed.
    const lockToken = `lock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await base44.asServiceRole.entities.Suggestion.update(suggestionId, {
      _acceptanceLock: lockToken
    });
    // Small delay to let a concurrent write settle before we read back
    await new Promise(r => setTimeout(r, 200));
    const locked = await base44.asServiceRole.entities.Suggestion.get(suggestionId);
    if (!locked || locked._acceptanceLock !== lockToken) {
      console.log('[PROCESS ACCEPTANCE] Race condition detected — another instance claimed the lock, skipping');
      return Response.json({ success: true, message: 'Already processed by another instance' });
    }
    // Re-check status after winning the lock (another instance may have accepted in between)
    if (locked.status !== 'pending') {
      console.log('[PROCESS ACCEPTANCE] Already accepted by another instance after lock check, skipping');
      return Response.json({ success: true, message: 'Already processed' });
    }

    // ── Consensus math ───────────────────────────────────────────────────────
    const totalUsers        = await calculateContributors(base44, documentId);
    const delta             = (suggestion.proVotes || 0) - (suggestion.conVotes || 0);
    const boundedConsensus  = Math.min(1, Math.max(0, (delta + totalUsers) / (2 * totalUsers)));
    const updatedConsensuses = [...(document.consensuses || []), boundedConsensus];
    // Assert all values are [0,1] to catch data errors early instead of silently masking them
    const consensusAvg      = updatedConsensuses.reduce((s, v) => {
      if (v < 0 || v > 1) console.warn('[PROCESS ACCEPTANCE] Consensus out of bounds:', v);
      return s + v;
    }, 0) / updatedConsensuses.length;
    const newThreshold      = Math.max(2, Math.round(consensusAvg * totalUsers));

    console.log('[PROCESS ACCEPTANCE] Calculated:', { totalUsers, boundedConsensus, newThreshold });

    // ── Delegate type-specific mutation ──────────────────────────────────────
    // CRITICAL: Wrap in try-catch to prevent silent data corruption
    // If mutation fails, rollback status and bail out
    try {
      if (suggestion.type === 'edit_section' && suggestion.sectionId) {
        await base44.asServiceRole.functions.invoke('_acceptEditSection', { suggestion, voterId });

      } else if (suggestion.type === 'new_section') {
        await base44.asServiceRole.functions.invoke('_acceptNewSection', {
          suggestion, voterId, boundedConsensus, totalUsers, newThreshold, suggestionId
        });

      } else if (suggestion.type === 'edit_suggestion' && suggestion.parentSuggestionId) {
        await base44.asServiceRole.functions.invoke('_acceptEditSuggestion', { suggestion, voterId, wasNewVote });

      } else if (suggestion.type === 'delete_section' && suggestion.sectionId) {
        await base44.asServiceRole.functions.invoke('_acceptDeleteSection', {
          suggestion,
          documentGamificationEnabled: !!document.gamificationEnabled
        });
      }
    } catch (mutationErr) {
      console.error('[PROCESS ACCEPTANCE] Type-specific mutation failed, aborting acceptance:', mutationErr);
      return Response.json({ 
        error: 'Document mutation failed: ' + mutationErr.message, 
        details: mutationErr.stack 
      }, { status: 500 });
    }

    // ── Now that document mutations succeeded, mark suggestion as accepted ─────
    try {
      await base44.asServiceRole.entities.Suggestion.update(suggestionId, { status: 'accepted' });
    } catch (statusErr) {
      console.error('[PROCESS ACCEPTANCE] Failed to mark as accepted after successful mutations:', statusErr);
      return Response.json({ 
        error: 'Failed to finalize acceptance: ' + statusErr.message
      }, { status: 500 });
    }

    // ── Update document + propagate threshold to pending siblings ─────────────
    const pendingSuggestions = await base44.asServiceRole.entities.Suggestion.filter({
      documentId: document.id, status: 'pending'
    });

    const updates = [
      base44.asServiceRole.entities.Document.update(document.id, {
        consensuses: updatedConsensuses,
        threshold: newThreshold,
        totalUsersInteracted: totalUsers
      }),
      ...pendingSuggestions
        .filter(p => p.id !== suggestionId)
        .map(p => {
          if (p.type === 'edit_section' && p.sectionId === suggestion.sectionId && suggestion.type === 'edit_section') {
            // GUARD: Only update originalContent if suggestion.newContent is valid
            const newOriginalContent = suggestion.newContent && suggestion.newContent.trim();
            if (!newOriginalContent) {
              console.warn('[PROCESS ACCEPTANCE] Skipping invalid originalContent update for sibling', p.id);
              return base44.asServiceRole.entities.Suggestion.update(p.id, { threshold: newThreshold });
            }
            return base44.asServiceRole.entities.Suggestion.update(p.id, {
              threshold: newThreshold, originalContent: newOriginalContent
            });
          }
          return base44.asServiceRole.entities.Suggestion.update(p.id, { threshold: newThreshold });
        })
    ];

    // new_section already set its own suggestionConsensus inside _acceptNewSection
    if (suggestion.type !== 'new_section') {
      updates.push(
        base44.asServiceRole.entities.Suggestion.update(suggestionId, {
          suggestionConsensus: boundedConsensus,
          participantsAtAcceptance: totalUsers
        })
      );
    }

    // Use Promise.allSettled to prevent one failure from blocking all updates
    const results = await Promise.allSettled(updates);
    const failures = results.filter((r, i) => r.status === 'rejected');
    if (failures.length > 0) {
      console.error('[PROCESS ACCEPTANCE] Some updates failed:', failures.map(f => f.reason));
    }

    // ── Notifications ────────────────────────────────────────────────────────
    const contributorEmails = await collectContributorEmails(base44, document);
    if (contributorEmails.size > 0) {
      const allSystemUsers = await base44.asServiceRole.entities.User.list();
      const recipients     = allSystemUsers.filter(u => u.email && contributorEmails.has(u.email));

      const suggTitle              = suggestion.title || 'הצעה';
      const creatorReplacements    = { title: suggTitle };
      const participantReplacements = { title: suggTitle, doc: document.title };
      const creatorTranslations    = buildNotifTranslations('creatorTitle', 'creatorMessage', creatorReplacements);
      const participantTranslations = buildNotifTranslations('participantTitle', 'participantMessage', participantReplacements);

      const notifications = recipients.map(user => {
        const lang     = user.preferredLanguage || 'he';
        const isCreator = user.email === suggestion.created_by;
        return {
          userId:            user.id,
          type:              'suggestion_accepted',
          title:             nt(lang, isCreator ? 'creatorTitle' : 'participantTitle',
                                isCreator ? creatorReplacements : participantReplacements),
          message:           nt(lang, isCreator ? 'creatorMessage' : 'participantMessage',
                                isCreator ? creatorReplacements : participantReplacements),
          translations:      isCreator ? creatorTranslations : participantTranslations,
          relatedEntityId:   suggestion.id,
          relatedEntityType: 'suggestion',
          actionUrl:         isCreator
                               ? `/documentview?id=${document.id}`
                               : `/suggestiondetail?id=${suggestion.id}`,
          read:              false
        };
      });

      if (notifications.length > 0) {
        try {
          await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
          console.log('[PROCESS ACCEPTANCE] ✓ Sent', notifications.length, 'notifications');
        } catch (err) {
          console.error('[PROCESS ACCEPTANCE] Notification batch failed:', err);
        }
      }
    }

    // ── Points ───────────────────────────────────────────────────────────────
    if (document.gamificationEnabled) {
      try {
        await base44.asServiceRole.functions.invoke('awardSuggestionPoints', {
          suggestionId: suggestion.id, action: 'suggestion_accepted'
        });
        console.log('[PROCESS ACCEPTANCE] ✓ Points awarded');
      } catch (err) {
        console.error('[PROCESS ACCEPTANCE] Points failed:', err);
      }
    }

    console.log('[PROCESS ACCEPTANCE] Completed successfully');
    return Response.json({ success: true, accepted: true, message: 'ההצעה התקבלה בהצלחה' });

  } catch (error) {
    console.error('[PROCESS ACCEPTANCE ERROR]', error);
    return Response.json({ error: error.message, details: error.stack }, { status: 500 });
  }
});