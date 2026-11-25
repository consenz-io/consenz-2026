import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Deleting an account without erasing the group's record.
//
// Personal data and private records are deleted outright. Public contributions
// (proposals, comments, votes) stay in the documents so the group's decisions
// and their tally remain valid, but they are detached from the person: the
// public profile is replaced by a neutral label, the stored email on those
// records is scrubbed and the account record itself is removed.
const DELETED_DISPLAY_NAME = 'Deleted participant';
const SCRUBBED_CREATOR = 'deleted-user@removed.invalid';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== 'DELETE') {
      return Response.json({ error: 'confirmation_required' }, { status: 400 });
    }
    if (user.role === 'admin') {
      return Response.json({ error: 'admin_account' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const id = user.id;
    const email = user.email;
    const failed = [];

    const steps = [
      ['notifications', () => sr.entities.Notification.deleteMany({ userId: id })],
      ['points_history', () => sr.entities.PointsTransaction.deleteMany({ userId: id })],
      ['messages_sent', () => sr.entities.Message.deleteMany({ senderId: id })],
      ['messages_received', () => sr.entities.Message.deleteMany({ recipientId: id })],
      ['conversations', () => sr.entities.Conversation.deleteMany({ participants: id })],
      ['group_memberships', () => sr.entities.GroupMember.deleteMany({ userId: id })],
      ['join_requests', () => sr.entities.GroupJoinRequest.deleteMany({ userId: id })],
      ['group_invitations', () => sr.entities.GroupInvitation.deleteMany({ email })],
      ['document_invitations', () => sr.entities.Invitation.deleteMany({ email })],
      ['document_managers', () => sr.entities.DocumentAdmin.deleteMany({ userId: id })],
      ['document_visits', () => sr.entities.UserInteraction.deleteMany({ userId: id })],
      ['convinced_clicks', () => sr.entities.ConvincedClick.deleteMany({ userId: id })],
      ['email_logs_sent', () => sr.entities.EmailLog.deleteMany({ senderUserId: id })],
      ['email_logs_to', () => sr.entities.EmailLog.deleteMany({ recipientEmail: email })],
      ['email_logs_from', () => sr.entities.EmailLog.deleteMany({ senderEmail: email })],
      // A signature on a document stays (the document's record depends on it),
      // but the address attached to it does not.
      ['signature_email', () => sr.entities.DocumentAgreement.updateMany({ userId: id }, { $set: { userEmail: '' } })],
      // Comments liked by this user carry their email in other people's records.
      ['comment_likes', () => sr.entities.Comment.updateMany({ likes: email }, { $pull: { likes: email } })],
      ['comment_creator', () => sr.entities.Comment.updateMany({ created_by: email }, { $set: { created_by: SCRUBBED_CREATOR } })],
      ['suggestion_creator', () => sr.entities.Suggestion.updateMany({ created_by: email }, { $set: { created_by: SCRUBBED_CREATOR } })],
      ['vote_creator', () => sr.entities.Vote.updateMany({ created_by: email }, { $set: { created_by: SCRUBBED_CREATOR } })],
      ['section_vote_creator', () => sr.entities.SectionVote.updateMany({ created_by: email }, { $set: { created_by: SCRUBBED_CREATOR } })],
      ['topic_edit_creator', () => sr.entities.TopicEditSuggestion.updateMany({ created_by: email }, { $set: { created_by: SCRUBBED_CREATOR } })],
      ['topic_vote_creator', () => sr.entities.TopicEditVote.updateMany({ created_by: email }, { $set: { created_by: SCRUBBED_CREATOR } })],
      ['argument_creator', () => sr.entities.Argument.updateMany({ created_by: email }, { $set: { created_by: SCRUBBED_CREATOR } })],
      ['document_creator', () => sr.entities.Document.updateMany({ created_by: email }, { $set: { created_by: SCRUBBED_CREATOR } })],
    ];

    // Independent calls, run in batches of six.
    for (let i = 0; i < steps.length; i += 6) {
      await Promise.all(steps.slice(i, i + 6).map(([label, run]) =>
        run().catch((e) => { failed.push(`${label}: ${e.message}`); })
      ));
    }

    // Keep one profile row per account so names resolve to a neutral label
    // instead of leaking an id or an email prefix, but strip everything personal.
    const profiles = await sr.entities.UserPublicProfile.filter({ userId: id }).catch(() => []);
    for (const profile of profiles) {
      await sr.entities.UserPublicProfile.update(profile.id, {
        fullName: DELETED_DISPLAY_NAME,
        email: '',
        avatar: '',
        nameChangedAt: null,
      }).catch((e) => { failed.push(`profile: ${e.message}`); });
    }

    // The account record goes last: if anything above failed, the user can still
    // sign in and run the deletion again.
    await sr.entities.User.delete(id);

    return Response.json({ success: true, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}