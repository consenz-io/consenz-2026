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

    // Rate limiting: Check recent emails from this user (max 100 per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentEmails = await base44.asServiceRole.entities.EmailLog.filter({
      senderUserId: user.id,
      created_date: { $gte: oneHourAgo }
    });

    if (recentEmails.length >= 100) {
      return Response.json({ 
        error: 'Rate limit exceeded. Maximum 100 emails per hour.',
        remainingTime: Math.ceil((new Date(recentEmails[0].created_date).getTime() + 60 * 60 * 1000 - Date.now()) / 60000)
      }, { status: 429 });
    }

    // Send email via Base44 Core integration
    let success = true;
    let errorMessage = null;

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: to,
        subject: subject,
        body: html || text
      });
    } catch (emailError) {
      success = false;
      errorMessage = emailError.message || 'Failed to send email';
      console.error('Email error:', errorMessage);
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