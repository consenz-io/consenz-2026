import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildTranslations, t } from '../../shared/notificationTranslations.ts';
import { verifyGroupMembership } from '../../shared/documentAuth.ts';

/**
 * Admin Activity Digest — detects new participants in the calling admin's
 * group documents and creates `admin_group_new_participant` notifications.
 *
 * Called on admin login (from the frontend Layout) or via a daily schedule.
 * Uses the user's `lastAdminDigestAt` timestamp to find only participants
 * who joined since the last check. On the first run, defaults to the last
 * 24 hours so the admin isn't flooded with every historical participant.
 *
 * Returns the count of new-participant notifications created.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;

    // 1. Find candidate group memberships. GroupMember.create RLS is open, so a
    //    membership record alone is NOT proof of admin status — we must verify
    //    provenance via verifyGroupMembership (same as manageGroupMembership /
    //    sendGroupEmail / sendGroupInvitation). Otherwise a user could self-grant
    //    an admin record for a private group and enumerate its participants.
    const adminMemberships = await sr.entities.GroupMember.filter({
      userId: user.id,
      role: 'admin',
    });
    if (!adminMemberships || adminMemberships.length === 0) {
      return Response.json({ success: true, newParticipants: 0, reason: 'not_group_admin' });
    }

    const candidateGroupIds = adminMemberships.map((m) => m.groupId).filter(Boolean);
    const candidateGroups = await sr.entities.Group.filter({ id: { $in: candidateGroupIds } });

    // Only keep groups where the caller's admin status has verified provenance.
    const verifiedGroups = [];
    for (const group of candidateGroups) {
      const { isAdmin } = await verifyGroupMembership(base44, group, user);
      if (isAdmin) verifiedGroups.push(group);
    }

    if (verifiedGroups.length === 0) {
      return Response.json({ success: true, newParticipants: 0, reason: 'not_group_admin' });
    }

    const groupIds = verifiedGroups.map((g) => g.id);

    // 2. Find all documents in those groups
    const documents = await sr.entities.Document.filter({ groupId: { $in: groupIds } });
    if (!documents || documents.length === 0) {
      return Response.json({ success: true, newParticipants: 0 });
    }

    const docIds = documents.map((d) => d.id);
    const docMap = new Map(documents.map((d) => [d.id, d]));

    // 3. Find all UserInteraction records for those documents
    const interactions = await sr.entities.UserInteraction.filter({
      documentId: { $in: docIds },
    });

    // 4. Determine the cutoff: last digest time, or 24h ago on first run
    const lastDigestAt = user.lastAdminDigestAt
      ? new Date(user.lastAdminDigestAt)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 5. Filter to new participants (firstInteractionAt or created_date > cutoff)
    const newInteractions = interactions.filter((i) => {
      const ts = i.firstInteractionAt || i.created_date;
      return ts && new Date(ts) > lastDigestAt;
    });

    if (newInteractions.length === 0) {
      await sr.entities.User.update(user.id, { lastAdminDigestAt: new Date().toISOString() });
      return Response.json({ success: true, newParticipants: 0 });
    }

    // 6. Resolve participant names
    const participantIds = [...new Set(newInteractions.map((i) => i.userId).filter(Boolean))];
    const [participantUsers, participantProfiles] = await Promise.all([
      sr.entities.User.filter({ id: { $in: participantIds } }),
      sr.entities.UserPublicProfile.filter({ userId: { $in: participantIds } }),
    ]);

    const nameFor = (uid) => {
      const profile = participantProfiles.find((p) => p.userId === uid);
      const u = participantUsers.find((u) => u.id === uid);
      return profile?.fullName || u?.full_name || 'User';
    };

    // 7. Create one notification per new participant × document
    const userLang = user.preferredLanguage || 'he';
    const notifications = newInteractions.map((interaction) => {
      const doc = docMap.get(interaction.documentId);
      const participantName = nameFor(interaction.userId);
      const replacements = { name: participantName, doc: doc?.title || '' };
      const translations = buildTranslations('adminNewParticipantTitle', 'adminNewParticipantMessage', replacements);

      return {
        userId: user.id,
        type: 'admin_group_new_participant',
        title: t(userLang, 'adminNewParticipantTitle', replacements),
        message: t(userLang, 'adminNewParticipantMessage', replacements),
        translations,
        relatedEntityId: interaction.documentId,
        relatedEntityType: 'document',
        actionUrl: `/documentview?id=${interaction.documentId}`,
        read: false,
      };
    });

    if (notifications.length > 0) {
      await sr.entities.Notification.bulkCreate(notifications);
      console.log('[ADMIN DIGEST] Created', notifications.length, 'new-participant notifications for admin', user.id);
    }

    // 8. Update lastAdminDigestAt
    await sr.entities.User.update(user.id, { lastAdminDigestAt: new Date().toISOString() });

    return Response.json({ success: true, newParticipants: notifications.length });
  } catch (error) {
    console.error('[ADMIN DIGEST ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}