import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, html, text, purpose, relatedEntityId, relatedEntityType } = await req.json();

    if (!to || !subject || (!html && !text)) {
      return Response.json({ error: 'Missing required fields: to, subject, and html or text' }, { status: 400 });
    }

    // Rate limiting: Check recent emails from this user (max 50 per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentEmails = await base44.entities.EmailLog.filter({
      senderUserId: user.id,
      created_date: { $gte: oneHourAgo }
    });

    if (recentEmails.length >= 50) {
      return Response.json({ 
        error: 'Rate limit exceeded. Maximum 50 emails per hour.' 
      }, { status: 429 });
    }

    // Get SendGrid API key and from email from secrets
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
    const fromEmail = Deno.env.get('email_from');

    if (!sendgridApiKey || !fromEmail) {
      throw new Error('SendGrid configuration missing');
    }

    // Send email via SendGrid REST API
    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: 'Consenz' },
        subject: subject,
        content: [
          html ? { type: 'text/html', value: html } : { type: 'text/plain', value: text }
        ]
      })
    });

    const success = sendgridResponse.status === 202;
    let errorMessage = null;

    if (!success) {
      const errorBody = await sendgridResponse.text();
      errorMessage = `SendGrid error (${sendgridResponse.status}): ${errorBody}`;
      console.error('SendGrid error:', errorMessage);
    }

    // Log the email attempt
    await base44.asServiceRole.entities.EmailLog.create({
      senderUserId: user.id,
      senderEmail: user.email,
      recipientEmail: to,
      subject: subject,
      purpose: purpose || 'other',
      status: success ? 'sent' : 'failed',
      errorMessage: errorMessage,
      relatedEntityId: relatedEntityId || null,
      relatedEntityType: relatedEntityType || null
    });

    if (!success) {
      return Response.json({ 
        error: 'Failed to send email', 
        details: errorMessage 
      }, { status: 500 });
    }

    return Response.json({ 
      success: true, 
      message: 'Email sent successfully' 
    });

  } catch (error) {
    console.error('Error sending external email:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});