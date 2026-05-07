import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId, summaryContent, isTestEmail } = await req.json();

    if (!documentId || !summaryContent) {
      return Response.json({ error: 'documentId and summaryContent are required' }, { status: 400 });
    }

    // Verify user is admin of this document
    const adminRecords = await base44.asServiceRole.entities.DocumentAdmin.filter({ documentId, userId: user.id });
    if (adminRecords.length === 0 && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Document admin access required' }, { status: 403 });
    }

    const document = await base44.asServiceRole.entities.Document.filter({ id: documentId }).then(d => d[0]);
    if (!document) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    let recipientEmails = [];

    if (isTestEmail) {
      // Send only to the admin
      recipientEmails = [user.email];
    } else {
      // Collect all participant emails
      const [suggestions, sections, votes, comments, agreements] = await Promise.all([
        base44.asServiceRole.entities.Suggestion.filter({ documentId }),
        base44.asServiceRole.entities.Section.filter({ documentId }),
        base44.asServiceRole.entities.Vote.list(),
        base44.asServiceRole.entities.Comment.list(),
        base44.asServiceRole.entities.DocumentAgreement.filter({ documentId }),
      ]);

      const suggestionIds = new Set(suggestions.map(s => s.id));
      const sectionIds = new Set(sections.map(s => s.id));

      const emailSet = new Set();
      suggestions.forEach(s => { if (s.created_by) emailSet.add(s.created_by); });
      votes.filter(v => suggestionIds.has(v.suggestionId)).forEach(v => { if (v.created_by) emailSet.add(v.created_by); });
      comments.filter(c =>
        (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) ||
        (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) ||
        (c.rootEntityType === 'document' && c.rootEntityId === documentId)
      ).forEach(c => { if (c.created_by) emailSet.add(c.created_by); });
      agreements.forEach(a => { if (a.userEmail) emailSet.add(a.userEmail); });

      recipientEmails = [...emailSet];
    }

    if (recipientEmails.length === 0) {
      return Response.json({ error: 'No recipients found' }, { status: 400 });
    }

    const subject = isTestEmail
      ? `[TEST] סיכום פעילות - ${document.title}`
      : `סיכום פעילות - ${document.title}`;

    const emailBody = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; direction: rtl; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 8px 0 0; opacity: 0.85; font-size: 14px; }
    .body { padding: 24px; color: #1e293b; line-height: 1.7; }
    .footer { background: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; }
    ${isTestEmail ? '.test-banner { background: #fef3c7; border: 2px solid #f59e0b; padding: 10px 16px; text-align: center; font-weight: bold; color: #92400e; }' : ''}
  </style>
</head>
<body>
  <div class="container">
    ${isTestEmail ? '<div class="test-banner">⚠️ מייל בדיקה — לא נשלח למשתתפים אחרים</div>' : ''}
    <div class="header">
      <h1>📄 ${document.title}</h1>
      <p>Consenz — פלטפורמת הקונצנזוס השיתופי</p>
    </div>
    <div class="body">
      ${summaryContent}
    </div>
    <div class="footer">
      נשלח דרך <strong>Consenz</strong> | לצפייה במסמך <a href="${typeof globalThis !== 'undefined' ? '' : ''}">לחץ כאן</a>
    </div>
  </div>
</body>
</html>`;

    // Send emails (sequentially to avoid rate limits)
    const results = [];
    for (const email of recipientEmails) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject,
          body: emailBody,
          from_name: `Consenz — ${document.title}`,
        });
        results.push({ email, success: true });
      } catch (err) {
        results.push({ email, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return Response.json({
      sent: successCount,
      failed: results.length - successCount,
      total: results.length,
      isTestEmail,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});