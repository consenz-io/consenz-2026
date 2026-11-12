import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { checkDocumentAuthorization } from '../../shared/documentAuth.ts';
import { buildTranslations, t } from '../../shared/notificationTranslations.ts';
import { awardRejectionVotePoints } from '../../shared/rejectionVotePoints.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate the caller — this endpoint performs service-role mutations
    // (rejecting suggestions, awarding points) and must not be callable anonymously.
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // sectionIds: array of section IDs that were deleted
    // documentId: the document these sections belong to
    // gamificationEnabled is read from the document record server-side (not
    // the request body) to prevent point farming via a client-supplied flag.
    const { sectionIds, documentId } = await req.json();

    if (!sectionIds || sectionIds.length === 0 || !documentId) {
      return Response.json({ success: true, message: 'No sectionIds provided' });
    }

    // Authorization: verify against non-client-writable data (document
    // ownership or a DocumentAdmin record created by the document's original
    // creator) — NOT the openly-creatable DocumentAdmin entity alone, which
    // any user could self-grant to bypass this check.
    const { authorized, document, notFound } = await checkDocumentAuthorization(base44, documentId, user);
    if (notFound) return Response.json({ error: 'Document not found' }, { status: 404 });
    if (!authorized) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Verify the referenced sections actually no longer exist — prevents
    // abuse where a caller passes active sectionIds to reject suggestions on
    // live sections.
    const stillExisting = await base44.asServiceRole.entities.Section.filter({
      id: { $in: sectionIds }
    });
    if (stillExisting.length > 0) {
      return Response.json({ error: 'Cannot reject: one or more sections still exist' }, { status: 400 });
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

    // Reject all orphaned suggestions — freeze the document's acceptance
    // threshold at rejection time so the progress bar shows the threshold that
    // was required when the suggestion was rejected, not the live value.
    const rejectionThreshold = document?.threshold ?? 2;
    await Promise.all(
      orphanedSuggestions.map(s =>
        base44.asServiceRole.entities.Suggestion.update(s.id, {
          status: 'rejected',
          rejectedByAdmin: false, // rejected due to section deletion, not admin action
          thresholdAtRejection: rejectionThreshold
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

      // Rejection is rewarded for the opposing voters (shared helper checks
      // gamification on the document record, never the request body).
      await awardRejectionVotePoints(
        base44.asServiceRole,
        { ...suggestion, status: 'rejected' },
        document
      );
    }

    console.log('[REJECT ORPHANED] Done. Rejected:', orphanedSuggestions.length);
    return Response.json({ success: true, rejected: orphanedSuggestions.length });

  } catch (error) {
    console.error('[REJECT ORPHANED ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});