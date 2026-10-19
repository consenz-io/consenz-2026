import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { checkDocumentAuthorization } from '../../shared/documentAuth.ts';
import { buildTranslations, t } from '../../shared/notificationTranslations.ts';

/**
 * notifySuggestionReopened
 *
 * Called by an admin after returning an expired/rejected suggestion to voting
 * (status → 'pending'). Notifies ALL document participants — not just the
 * creator — that the suggestion is open for voting again, using a distinct
 * `suggestion_reopened` notification type (not the stale `suggestion_expiring`
 * notification that was previously re-sent).
 *
 * Participants are resolved the same way as handleNewComment/handleNewSuggestion:
 * UserInteraction records for the document + group members + interactions on
 * other documents in the same group.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { suggestionId } = body;
    if (!suggestionId) {
      return Response.json({ error: 'suggestionId is required' }, { status: 400 });
    }

    // Fetch the suggestion (service role — avoids RLS on the read)
    const suggestion = await base44.asServiceRole.entities.Suggestion
      .filter({ id: suggestionId })
      .then(r => r[0])
      .catch(() => null);

    if (!suggestion) {
      return Response.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    // Verify the caller is authorized to administer the document
    const { authorized } = await checkDocumentAuthorization(
      base44.asServiceRole,
      suggestion.documentId,
      user
    );
    if (!authorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Collect all document participants: UserInteraction + group members +
    // interactions on other documents in the same group.
    const participantIds = new Set();
    const seen = new Set();

    const interactions = await base44.asServiceRole.entities.UserInteraction
      .filter({ documentId: suggestion.documentId })
      .catch(() => []);
    interactions.forEach(i => { if (i.userId) participantIds.add(i.userId); });

    const document = await base44.asServiceRole.entities.Document
      .filter({ id: suggestion.documentId })
      .then(r => r[0])
      .catch(() => null);

    if (document?.groupId) {
      const groupMembers = await base44.asServiceRole.entities.GroupMember
        .filter({ groupId: document.groupId })
        .catch(() => []);
      groupMembers.forEach(m => { if (m.userId) participantIds.add(m.userId); });

      const groupDocs = await base44.asServiceRole.entities.Document
        .filter({ groupId: document.groupId })
        .catch(() => []);
      const otherDocIds = groupDocs.map(d => d.id).filter(id => id !== suggestion.documentId);
      if (otherDocIds.length > 0) {
        const otherInteractions = await base44.asServiceRole.entities.UserInteraction
          .filter({ documentId: { $in: otherDocIds } })
          .catch(() => []);
        otherInteractions.forEach(i => { if (i.userId) participantIds.add(i.userId); });
      }
    }

    // Exclude the admin who performed the reopen — they initiated the action.
    participantIds.delete(user.id);

    if (participantIds.size === 0) {
      return Response.json({ success: true, notifiedCount: 0 });
    }

    // Fetch user records to resolve preferred language for the stored title/message.
    const userIds = [...participantIds];
    const users = await base44.asServiceRole.entities.User
      .filter({ id: { $in: userIds } })
      .catch(() => []);

    const replacements = { title: suggestion.title || '' };
    const translations = buildTranslations('suggestionReopenedTitle', 'suggestionReopenedMessage', replacements);
    const actionUrl = `/suggestiondetail?id=${suggestion.id}`;

    const notifications = users.map((u) => {
      const lang = u.preferredLanguage || 'he';
      return {
        userId: u.id,
        type: 'suggestion_reopened',
        title: t(lang, 'suggestionReopenedTitle', replacements),
        message: t(lang, 'suggestionReopenedMessage', replacements),
        translations,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl,
        read: false,
      };
    }).filter(n => !seen.has(n.userId) && seen.add(n.userId));

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }

    return Response.json({ success: true, notifiedCount: notifications.length });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}