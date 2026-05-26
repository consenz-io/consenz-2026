import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId, email, groupName, language } = await req.json();

    if (!groupId || !email || !email.includes('@')) {
      return Response.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

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

    const emailContent = {
      he: {
        subject: `הוזמנת להצטרף לקבוצה "${groupName}" ב-Consenz`,
        title: 'הוזמנת להצטרף לקבוצה!',
        body: `${senderName} הזמין אותך להצטרף לקבוצה <strong>"${groupName}"</strong> בפלטפורמת Consenz.`,
        cta: 'לחץ על הכפתור למטה כדי לקבל את ההזמנה:',
        button: 'הצטרפות לקבוצה',
        fallback: 'אם הכפתור לא עובד, העתק את הקישור:',
      },
      ar: {
        subject: `تمت دعوتك للانضمام إلى مجموعة "${groupName}" في Consenz`,
        title: 'تمت دعوتك للانضمام إلى المجموعة!',
        body: `قام ${senderName} بدعوتك للانضمام إلى مجموعة <strong>"${groupName}"</strong> على منصة Consenz.`,
        cta: 'انقر على الزر أدناه لقبول الدعوة:',
        button: 'الانضمام إلى المجموعة',
        fallback: 'إذا لم يعمل الزر، انسخ الرابط:',
      },
      en: {
        subject: `You've been invited to join the group "${groupName}" on Consenz`,
        title: "You've been invited to join a group!",
        body: `${senderName} has invited you to join the group <strong>"${groupName}"</strong> on the Consenz platform.`,
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