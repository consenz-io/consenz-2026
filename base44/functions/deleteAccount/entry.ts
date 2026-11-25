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

// Deleting an account cannot be undone, so it takes two steps: the user asks
// for a code, the code is mailed to the address on the account, and only a
// matching code deletes anything. A stolen open session is no longer enough.
// Only a hash of the code is stored, keyed with a server secret, so a leaked
// record cannot be brute-forced back into the code.
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const REQUEST_COOLDOWN_MS = 60 * 1000;

async function hashCode(userId, code, secret) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${userId}:${code}:${secret}`),
  );
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function deletionEmail(code, lang) {
  const strings = {
    he: {
      subject: 'קוד אישור למחיקת החשבון',
      title: 'קוד אישור למחיקת החשבון',
      intro: 'התקבלה בקשה למחוק את החשבון שלכם ב-Consenz. הזינו את הקוד הבא באפליקציה כדי להשלים את המחיקה:',
      note: 'הקוד תקף ל־15 דקות. אם לא ביקשתם למחוק את החשבון, אפשר להתעלם מהודעה זו והחשבון יישאר כפי שהוא.',
    },
    ar: {
      subject: 'رمز تأكيد حذف الحساب',
      title: 'رمز تأكيد حذف الحساب',
      intro: 'ورد طلب لحذف حسابك في Consenz. أدخل الرمز التالي في التطبيق لإتمام الحذف:',
      note: 'الرمز صالح لمدة 15 دقيقة. إذا لم تطلب حذف الحساب، يمكنك تجاهل هذه الرسالة وسيبقى الحساب كما هو.',
    },
    en: {
      subject: 'Your account deletion code',
      title: 'Your account deletion code',
      intro: 'A request was made to delete your Consenz account. Enter this code in the app to finish deleting it:',
      note: 'The code is valid for 15 minutes. If you did not ask to delete your account, ignore this message and the account stays as it is.',
    },
  };
  const t = strings[lang] || strings.en;
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#ffffff;font-family:'Noto Serif Hebrew',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
    <div style="background:#2563eb;padding:20px 24px;">
      <span style="color:#ffffff;font-size:18px;font-weight:700;">Consenz</span>
    </div>
    <div style="padding:28px 24px;background:#fafafa;">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">${t.title}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">${t.intro}</p>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;padding:16px;text-align:center;">
        <span style="font-family:Arial,sans-serif;font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;">${code}</span>
      </div>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">${t.note}</p>
    </div>
  </div>
</body></html>`;
  return { subject: t.subject, html };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (user.role === 'admin') {
      return Response.json({ error: 'admin_account' }, { status: 403 });
    }

    const secret = Deno.env.get('INTERNAL_AUTOMATION_TOKEN');
    if (!secret) {
      return Response.json({ error: 'not_configured' }, { status: 500 });
    }

    if (body.action === 'request') {
      const existing = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0]?.accountDeletion || {};
      if (existing.requestedAt) {
        const since = Date.now() - new Date(existing.requestedAt).getTime();
        if (since < REQUEST_COOLDOWN_MS) {
          return Response.json({
            error: 'too_soon',
            retryInSeconds: Math.ceil((REQUEST_COOLDOWN_MS - since) / 1000),
          }, { status: 429 });
        }
      }

      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
      await base44.asServiceRole.entities.User.update(user.id, {
        accountDeletion: {
          codeHash: await hashCode(user.id, code, secret),
          expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
          requestedAt: new Date().toISOString(),
          attempts: 0,
        },
      });

      const lang = ['he', 'en', 'ar'].includes(body.language)
        ? body.language
        : (['he', 'en', 'ar'].includes(user.preferredLanguage) ? user.preferredLanguage : 'en');
      const { subject, html } = deletionEmail(code, lang);
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject,
        html,
        category: 'transactional',
      });

      return Response.json({ success: true, status: 'code_sent' });
    }

    if (body.action !== 'confirm') {
      return Response.json({ error: 'confirmation_required' }, { status: 400 });
    }

    const code = String(body.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      return Response.json({ error: 'invalid_code' }, { status: 400 });
    }

    const pending = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0]?.accountDeletion;
    if (!pending?.codeHash || !pending?.expiresAt) {
      return Response.json({ error: 'code_expired' }, { status: 400 });
    }
    if (Date.now() > new Date(pending.expiresAt).getTime()) {
      return Response.json({ error: 'code_expired' }, { status: 400 });
    }
    const attempts = Number(pending.attempts) || 0;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      return Response.json({ error: 'too_many_attempts' }, { status: 429 });
    }

    const expected = await hashCode(user.id, code, secret);
    if (expected !== pending.codeHash) {
      await base44.asServiceRole.entities.User
        .update(user.id, { accountDeletion: { ...pending, attempts: attempts + 1 } })
        .catch(() => {});
      return Response.json({ error: 'invalid_code' }, { status: 400 });
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