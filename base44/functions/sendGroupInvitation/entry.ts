import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId, email, groupName } = await req.json();

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

    const inviteUrl = `https://app.consenz.io/login?groupInvite=${token}`;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Consenz <no-reply@consenz.net>',
        to: [email],
        subject: `הוזמנת להצטרף לקבוצה "${groupName}" ב-Consenz`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">הוזמנת להצטרף לקבוצה!</h2>
            <p>${user.full_name || 'מישהו'} הזמין אותך להצטרף לקבוצה <strong>"${groupName}"</strong> בפלטפורמת Consenz.</p>
            <p>לחץ על הכפתור למטה כדי לקבל את ההזמנה:</p>
            <a href="${inviteUrl}" 
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
              הצטרף לקבוצה
            </a>
            <p style="color: #64748b; font-size: 14px;">אם הכפתור לא עובד, העתק את הקישור: <br/><a href="${inviteUrl}">${inviteUrl}</a></p>
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