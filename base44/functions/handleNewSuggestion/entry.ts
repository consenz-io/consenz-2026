import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { authorizeInternalOrUser } from '../../shared/authGate.ts';
import { buildTranslations, t } from '../../shared/notificationTranslations.ts';

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('[SUGGESTION AUTOMATION] ===== START =====');

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data: suggestion, args = {} } = body;
    // Auth: only the platform workflow (internal token) or an admin may call.
    // Previously any anonymous caller who referenced a real Suggestion ID
    // could pass the check and trigger notifications.
    const { ok, response } = await authorizeInternalOrUser(base44, body);
    if (!ok) return response;

    if (!suggestion || event.type !== 'create') {
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    // delete_section suggestions are no longer created via the UI (the suggestion
    // path was deprecated in favor of direct community voting via voteOnSection).
    // System-generated delete_section suggestions (created by voteOnSection using
    // the service role) arrive with status 'accepted' and are skipped here —
    // voteOnSection already sends its own section_deleted notifications.
    // A user-created delete_section (status 'pending') means someone bypassed the
    // UI and called the API directly — block it by deleting the record. Historical
    // pending delete_section suggestions are unaffected: they were created before
    // this change and won't re-trigger this create-event handler.
    if (suggestion.type === 'delete_section') {
      if (suggestion.status === 'pending') {
        try {
          await base44.asServiceRole.entities.Suggestion.delete(suggestion.id);
          console.log('[SUGGESTION AUTOMATION] Blocked user-created delete_section suggestion', suggestion.id);
        } catch (e) {
          console.error('[SUGGESTION AUTOMATION] Failed to block delete_section:', e);
        }
        return Response.json({ error: 'delete_section suggestions are no longer supported via this path' }, { status: 400 });
      }
      return Response.json({ message: 'Skipping system-generated delete_section suggestion' }, { status: 200 });
    }

    console.log('[SUGGESTION AUTOMATION] Processing new suggestion:', suggestion.id);

    // Idempotency: skip if notifications were already created for this suggestion
    // (prevents replay attacks using real suggestion IDs)
    const existingNotifs = await base44.asServiceRole.entities.Notification.filter({
      relatedEntityId: suggestion.id,
      type: 'new_suggestion_in_followed_document'
    });
    if (existingNotifs.length > 0) {
      console.log('[SUGGESTION AUTOMATION] Already processed suggestion', suggestion.id, '— skipping');
      return Response.json({ success: true, notificationsSent: 0, skipped: true });
    }

    // Defense-in-depth: clamp timerEndsAt to a minimum of 1 hour from now to
    // prevent point farming via suggestions created with already-expired timers
    if (suggestion.timerEndsAt) {
      const timerEnd = new Date(suggestion.timerEndsAt);
      const minEnd = new Date(Date.now() + 60 * 60 * 1000);
      if (timerEnd < minEnd) {
        await base44.asServiceRole.entities.Suggestion.update(suggestion.id, { timerEndsAt: minEnd.toISOString() });
        console.log('[SUGGESTION AUTOMATION] Clamped timerEndsAt to 1h minimum for suggestion', suggestion.id);
      }
    }

    const [documents, interactions, creatorProfiles, creatorUsers] = await Promise.all([
      base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }),
      base44.asServiceRole.entities.UserInteraction.filter({ documentId: suggestion.documentId }),
      base44.asServiceRole.entities.UserPublicProfile.filter({ userId: suggestion.created_by_id }),
      base44.asServiceRole.entities.User.filter({ id: suggestion.created_by_id })
    ]);

    const document = documents[0];
    if (!document) {
      return Response.json({ message: 'Document not found' }, { status: 404 });
    }

    const creatorProfile = creatorProfiles[0];
    // Fall back to User.full_name (always populated by auth) before the literal 'User'
    const creatorName = creatorProfile?.fullName || creatorUsers[0]?.full_name || 'User';

    // Collect user IDs from interactions + group members (if document belongs to a group)
    const interactionUserIds = new Set(interactions.map(i => i.userId));

    if (document.groupId) {
      // Add formal group members
      const groupMembers = await base44.asServiceRole.entities.GroupMember.filter({ groupId: document.groupId });
      groupMembers.forEach(m => { if (m.userId) interactionUserIds.add(m.userId); });

      // Add participants from all other documents in the group
      const groupDocs = await base44.asServiceRole.entities.Document.filter({ groupId: document.groupId });
      const otherDocIds = groupDocs.map(d => d.id).filter(id => id !== suggestion.documentId);
      if (otherDocIds.length > 0) {
        const otherInteractions = await base44.asServiceRole.entities.UserInteraction.filter({ documentId: { $in: otherDocIds } });
        otherInteractions.forEach(i => { if (i.userId) interactionUserIds.add(i.userId); });
      }

      console.log('[SUGGESTION AUTOMATION] Group notify list size after enrichment:', interactionUserIds.size);
    }

    // Exclude the suggestion creator from notifications
    const uniqueUserIds = [...interactionUserIds].filter(uid => uid !== suggestion.created_by_id);

    if (uniqueUserIds.length === 0) {
      console.log('[SUGGESTION AUTOMATION] No users to notify');
      return Response.json({ success: true, notificationsSent: 0 });
    }

    // Fetch users to get their preferredLanguage
    const allUsers = await base44.asServiceRole.entities.User.filter({ id: { $in: uniqueUserIds } });
    // Filter out the creator by id as well
    const users = allUsers.filter(u => u.id !== suggestion.created_by_id);

    const isEditSuggestion = suggestion.type === 'edit_suggestion';
    const titleKey = isEditSuggestion ? 'editSuggestionTitle' : 'newSuggestionTitle';
    const messageKey = isEditSuggestion ? 'editSuggestionMessage' : 'newSuggestionMessage';
    const replacements = { name: creatorName, title: document.title };
    const translationsObj = buildTranslations(titleKey, messageKey, replacements);

    const notifications = users.map(user => {
      const userLang = user.preferredLanguage || 'he';
      return {
        userId: user.id,
        type: 'new_suggestion_in_followed_document',
        title: t(userLang, titleKey, replacements),
        message: t(userLang, messageKey, replacements),
        translations: translationsObj,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl: `/documentview?id=${suggestion.documentId}&targetSuggestion=${suggestion.id}`,
        read: false
      };
    });

    await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    console.log('[SUGGESTION AUTOMATION] Created', notifications.length, 'notifications');

    const duration = Date.now() - startTime;
    return Response.json({ success: true, notificationsSent: notifications.length, duration });
  } catch (error) {
    console.error('[SUGGESTION AUTOMATION] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});