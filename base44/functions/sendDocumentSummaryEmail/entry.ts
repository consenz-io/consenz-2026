import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { documentId, summaryContent, isTestEmail, language } = await req.json();
  if (!documentId || !summaryContent) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify user is document admin or system admin
  const adminRecords = await base44.asServiceRole.entities.DocumentAdmin.filter({ documentId, userId: user.id });
  if (adminRecords.length === 0 && user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const document = await base44.asServiceRole.entities.Document.filter({ id: documentId }).then(r => r[0]);
  if (!document) return Response.json({ error: 'Document not found' }, { status: 404 });

  // Determine recipients
  let recipientEmails = [];

  if (isTestEmail) {
    recipientEmails = [user.email];
  } else {
    // Collect all participant emails from this document
    const [suggestions, sections, allVotes, allComments, allAgreements, publicProfiles] = await Promise.all([
      base44.asServiceRole.entities.Suggestion.filter({ documentId }),
      base44.asServiceRole.entities.Section.filter({ documentId }),
      base44.asServiceRole.entities.Vote.list(),
      base44.asServiceRole.entities.Comment.list(),
      base44.asServiceRole.entities.DocumentAgreement.filter({ documentId }),
      base44.asServiceRole.entities.UserPublicProfile.list(),
    ]);

    const suggestionIds = new Set(suggestions.map(s => s.id));
    const sectionIds = new Set(sections.map(s => s.id));
    const emailSet = new Set();

    suggestions.forEach(s => { if (s.created_by) emailSet.add(s.created_by); });
    allVotes.filter(v => suggestionIds.has(v.suggestionId)).forEach(v => { if (v.created_by) emailSet.add(v.created_by); });
    allComments.filter(c =>
      (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) ||
      (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) ||
      (c.rootEntityType === 'document' && c.rootEntityId === documentId)
    ).forEach(c => { if (c.created_by) emailSet.add(c.created_by); });
    allAgreements.forEach(a => { if (a.userEmail) emailSet.add(a.userEmail); });

    recipientEmails = [...emailSet].filter(Boolean);
  }

  if (recipientEmails.length === 0) {
    return Response.json({ error: 'No recipients found' }, { status: 400 });
  }

  // Determine text direction
  const isRTL = language === 'he' || language === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';
  const textAlign = isRTL ? 'right' : 'left';

  // Labels per language
  const labels = {
    he: {
      subject: `סיכום פעילות: ${document.title}`,
      viewDoc: 'לצפייה במסמך',
      footer: 'מייל זה נשלח אוטומטית על ידי פלטפורמת Consenz.',
      sentBy: `נשלח על ידי ${user.full_name}`,
    },
    ar: {
      subject: `ملخص النشاط: ${document.title}`,
      viewDoc: 'عرض الوثيقة',
      footer: 'تم إرسال هذا البريد الإلكتروني تلقائيًا بواسطة منصة Consenz.',
      sentBy: `أرسله ${user.full_name}`,
    },
    en: {
      subject: `Activity Summary: ${document.title}`,
      viewDoc: 'View Document',
      footer: 'This email was sent automatically by the Consenz platform.',
      sentBy: `Sent by ${user.full_name}`,
    },
  };

  const l = labels[language] || labels['en'];
  const appBase = Deno.env.get('APP_URL') || 'https://consenz.net';
  const docUrl = `${appBase}/DocumentView?id=${documentId}`;

  // Base URL for the trackEmailEvent backend function
  const trackBase = `${appBase}/api/functions/trackEmailEvent`;

  // Helper: wrap a URL with click tracking (given a logId)
  const trackClick = (logId, targetUrl) =>
    `${trackBase}?logId=${logId}&type=click&redirectUrl=${encodeURIComponent(targetUrl)}`;

  // Helper: build full HTML for one recipient (with unique logId for pixel + links)
  const buildEmailHtml = (logId) => {
    const pixelUrl = `${trackBase}?logId=${logId}&type=open`;
    const trackedDocUrl = trackClick(logId, docUrl);

    // Wrap all <a href="..."> links inside summaryContent with click tracking
    const trackedSummary = summaryContent.replace(
      /<a\s+([^>]*?)href="([^"]+)"([^>]*?)>/gi,
      (match, before, url, after) => {
        // Don't double-wrap already tracked links
        if (url.includes('trackEmailEvent')) return match;
        return `<a ${before}href="${trackClick(logId, url)}"${after}>`;
      }
    );

    return `<!DOCTYPE html>
<html lang="${language || 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${l.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,sans-serif;direction:${dir};text-align:${textAlign};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af,#4f46e5);padding:32px 24px;text-align:center;">
              <div style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Consenz</div>
              <div style="font-size:13px;color:#bfdbfe;margin-top:4px;">Collaborative Consensus</div>
            </td>
          </tr>

          <!-- Document title bar -->
          <tr>
            <td style="background:#eff6ff;padding:16px 24px;border-bottom:1px solid #dbeafe;">
              <div style="font-size:18px;font-weight:700;color:#1e3a8a;direction:${dir};text-align:${textAlign};">${document.title}</div>
              <div style="font-size:12px;color:#3b82f6;margin-top:4px;">${l.sentBy}</div>
            </td>
          </tr>

          <!-- Summary body -->
          <tr>
            <td style="padding:28px 24px;direction:${dir};text-align:${textAlign};">
              <div style="font-size:15px;line-height:1.8;color:#1e293b;white-space:pre-line;">${trackedSummary}</div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:8px 24px 28px;text-align:center;">
              <a href="${trackedDocUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#4f46e5);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;">${l.viewDoc} →</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;">
              <div style="font-size:12px;color:#94a3b8;">${l.footer}</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  <!-- Tracking pixel -->
  <img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />
</body>
</html>`;
  };

  // Send emails (sequentially to avoid rate limits)
  let sent = 0;
  const failed = [];
  const batchId = crypto.randomUUID();

  for (const email of recipientEmails) {
    let status = 'sent';
    let errorMessage = null;
    let logId = null;

    // Create log record FIRST to get the ID for tracking pixel/links
    try {
      const logRecord = await base44.asServiceRole.entities.EmailLog.create({
        senderUserId: user.id,
        senderEmail: user.email,
        recipientEmail: email,
        subject: l.subject,
        purpose: 'document_summary',
        status: 'sent', // will update if failed below
        relatedEntityId: documentId,
        relatedEntityType: 'document',
        openCount: 0,
        clickCount: 0,
        batchId,
        isTestEmail: !!isTestEmail,
      });
      logId = logRecord.id;
    } catch (logErr) {
      console.error('Failed to create email log:', logErr.message);
    }

    try {
      const emailHtml = buildEmailHtml(logId || 'unknown');
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: l.subject,
        body: emailHtml,
        from_name: 'Consenz',
      });
      sent++;
    } catch (err) {
      failed.push(email);
      status = 'failed';
      errorMessage = err.message;
      console.error(`Failed to send to ${email}:`, err.message);
      // Update log record with failure status
      if (logId) {
        await base44.asServiceRole.entities.EmailLog.update(logId, { status: 'failed', errorMessage }).catch(() => {});
      }
    }
  }

  return Response.json({
    sent,
    failed: failed.length,
    total: recipientEmails.length,
    isTestEmail: !!isTestEmail,
  });
});