import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId, email, language } = await req.json();

    if (!groupId || !email) {
      return Response.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    // Strict email validation — prevents malformed recipients being used as a relay
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Rate limit: max 10 invitations per user per hour — prevents open mail relay abuse
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentInvites = await base44.asServiceRole.entities.GroupInvitation.filter(
      { invitedBy: user.id }, '-created_date', 15
    );
    const recentCount = recentInvites.filter(i => i.created_date && i.created_date >= oneHourAgo).length;
    if (recentCount >= 10) {
      return Response.json({ error: 'Rate limit exceeded: max 10 invitations per hour' }, { status: 429 });
    }

    // Duplicate check: don't allow re-inviting an email that already has a pending
    // invitation to this group — prevents repeated relay to the same target
    const existingInvites = await base44.asServiceRole.entities.GroupInvitation.filter({ groupId, email });
    if (existingInvites.some(i => i.status === 'pending')) {
      return Response.json({ error: 'A pending invitation already exists for this email' }, { status: 409 });
    }

    // Fetch the group from the server — do not trust client-supplied group
    // identity or name. This both validates the groupId and gives a trusted
    // group name for the email body (preventing HTML injection via groupName).
    const group = await base44.asServiceRole.entities.Group.get(groupId).catch(() => null);
    if (!group) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    // Authorization: only system admins, the group creator, or an existing
    // member/admin of the group may send invitations for it.
    const isSystemAdmin = user.role === 'admin';
    const isGroupCreator = group.created_by_id === user.id;
    let isAuthorized = isSystemAdmin || isGroupCreator;
    if (!isAuthorized) {
      const memberships = await base44.asServiceRole.entities.GroupMember.filter({ groupId, userId: user.id });
      isAuthorized = memberships.length > 0;
    }
    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden: not a group member' }, { status: 403 });
    }

    const groupName = group.name;

    // Generate unique token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Create invitation record
    await base44.asServiceRole.entities.GroupInvitation.create({
      groupId,
      email,
      invitedBy: user.id,
      token,
      status: 'pending'
    });

    const inviteUrl = `https://consenz.net/login?groupInvite=${token}`;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    const lang = language || 'he';
    const isRTL = lang === 'he' || lang === 'ar';
    const senderName = user.full_name || (lang === 'he' ? 'מישהו' : lang === 'ar' ? 'شخص ما' : 'Someone');
    const safeGroupName = escapeHtml(groupName);
    const safeSenderName = escapeHtml(senderName);

    const emailContent = {
      he: {
        subject: `הוזמנת להצטרף לקבוצה "${groupName}" ב-Consenz`,
        title: 'הוזמנת להצטרף לקבוצה!',
        body: `${safeSenderName} הזמין אותך להצטרף לקבוצה <strong>"${safeGroupName}"</strong> בפלטפורמת Consenz.`,
        cta: 'לחץ על הכפתור למטה כדי לקבל את ההזמנה:',
        button: 'הצטרפות לקבוצה',
        fallback: 'אם הכפתור לא עובד, העתק את הקישור:',
      },
      ar: {
        subject: `تمت دعوتك للانضمام إلى مجموعة "${groupName}" في Consenz`,
        title: 'تمت دعوتك للانضمام إلى المجموعة!',
        body: `قام ${safeSenderName} بدعوتك للانضمام إلى مجموعة <strong>"${safeGroupName}"</strong> على منصة Consenz.`,
        cta: 'انقر على الزر أدناه لقبول الدعوة:',
        button: 'الانضمام إلى المجموعة',
        fallback: 'إذا لم يعمل الزر، انسخ الرابط:',
      },
      en: {
        subject: `You've been invited to join the group "${groupName}" on Consenz`,
        title: "You've been invited to join a group!",
        body: `${safeSenderName} has invited you to join the group <strong>"${safeGroupName}"</strong> on the Consenz platform.`,
        cta: 'Click the button below to accept the invitation:',
        button: 'Join the Group',
        fallback: "If the button doesn't work, copy the link:",
      },
    };

    const c = emailContent[lang] || emailContent['en'];
    const dir = isRTL ? 'rtl' : 'ltr';
    const textAlign = isRTL ? 'right' : 'left';

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Consenz <no-reply@consenz.net>',
        to: [email],
        subject: c.subject,
        html: `
          <div dir="${dir}" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: ${textAlign};">
            <h2 style="color: #1e40af;">${c.title}</h2>
            <p>${c.body}</p>
            <p>${c.cta}</p>
            <a href="${inviteUrl}" 
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
              ${c.button}
            </a>
            <p style="color: #64748b; font-size: 14px;">${c.fallback} <br/><a href="${inviteUrl}">${inviteUrl}</a></p>
          </div>
        `
      })
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.json();
      console.error('[sendGroupInvitation] Resend error:', errBody);
      return Response.json({ error: errBody.message || 'Failed to send email' }, { status: 500 });
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('[sendGroupInvitation] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});