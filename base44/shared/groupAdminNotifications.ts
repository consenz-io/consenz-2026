import { buildTranslations, t } from './notificationTranslations.ts';

/**
 * Creates `admin_group_activity` notifications for all admins of the group
 * linked to the given document.
 *
 * Used by handleNewVote, handleNewSuggestion, handleNewComment,
 * processAcceptanceV4, and voteOnSectionV2 to notify group admins about
 * every activity in their group's documents.
 *
 * Skips silently if:
 *   - The document has no groupId (standalone document)
 *   - The group has no admin members
 *   - The only admin is the actor themselves
 *
 * @param base44 - a service-role client (base44.asServiceRole from the caller)
 * @param documentId  - the document where the activity happened
 * @param actorId     - userId of the person who performed the action (excluded)
 * @param titleKey    - notificationTranslations key for the title
 * @param messageKey  - notificationTranslations key for the message
 * @param replacements - { name, doc, title, ... } substituted into the translations
 * @param actionUrl   - link the admin follows to see the activity
 * @param relatedEntityId   - the entity that was acted upon
 * @param relatedEntityType - 'suggestion' | 'section' | 'comment' | 'document'
 */
export async function notifyGroupAdmins(base44, {
  documentId,
  actorId = null,
  titleKey,
  messageKey,
  replacements = {},
  actionUrl,
  relatedEntityId,
  relatedEntityType,
}) {
  try {
    const docs = await base44.entities.Document.filter({ id: documentId });
    const document = docs?.[0];
    if (!document?.groupId) return { sent: 0, reason: 'no_group' };

    // Auto-fill the document title in replacements if the caller didn't provide it
    if (!replacements.doc) {
      replacements = { ...replacements, doc: document.title || '' };
    }

    const adminMembers = await base44.entities.GroupMember.filter({
      groupId: document.groupId,
      role: 'admin',
    });
    if (!adminMembers || adminMembers.length === 0) return { sent: 0, reason: 'no_admins' };

    const adminUserIds = adminMembers
      .map((m) => m.userId)
      .filter(Boolean)
      .filter((id) => id !== actorId);
    if (adminUserIds.length === 0) return { sent: 0, reason: 'actor_is_only_admin' };

    const users = await base44.entities.User.filter({ id: { $in: adminUserIds } });
    const translations = buildTranslations(titleKey, messageKey, replacements);

    const notifications = users.map((user) => {
      const userLang = user.preferredLanguage || 'he';
      return {
        userId: user.id,
        type: 'admin_group_activity',
        title: t(userLang, titleKey, replacements),
        message: t(userLang, messageKey, replacements),
        translations,
        relatedEntityId,
        relatedEntityType,
        actionUrl,
        read: false,
      };
    });

    await base44.entities.Notification.bulkCreate(notifications);
    console.log('[ADMIN NOTIFY] Sent', notifications.length, 'admin activity notifications for document', documentId);
    return { sent: notifications.length };
  } catch (e) {
    console.error('[ADMIN NOTIFY] Error for document', documentId, ':', e.message);
    return { sent: 0, error: e.message };
  }
}