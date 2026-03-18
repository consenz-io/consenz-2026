import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get user by email
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];

    // Get all digests from last week for this user
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const allDigests = await base44.asServiceRole.entities.EmailDigest.filter({ 
      userId: user.id 
    });

    // Filter to last week
    const lastWeekDigests = allDigests.filter(d => {
      const createdDate = new Date(d.created_date);
      return createdDate >= oneWeekAgo;
    });

    if (lastWeekDigests.length === 0) {
      return Response.json({ 
        message: 'No activity in the last week',
        emailSent: false 
      });
    }

    // Group by document
    const byDocument = {};
    for (const d of lastWeekDigests) {
      const docKey = d.documentId || 'general';
      if (!byDocument[docKey]) {
        byDocument[docKey] = {
          title: d.documentTitle || 'כללי',
          items: []
        };
      }
      byDocument[docKey].items.push(d);
    }

    // Build email content
    let emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🔔 Consenz - סיכום שבועי (בדיקה)</h2>
        <p>שלום ${user.full_name || user.email},</p>
        <p>זהו דוא"ל בדיקה. הנה הפעילות שלך מהשבוע האחרון (${lastWeekDigests.length} עדכונים):</p>
    `;

    for (const [docId, group] of Object.entries(byDocument)) {
      emailBody += `
        <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 8px; border-right: 4px solid #2563eb;">
          <h3 style="color: #1e40af; margin-top: 0;">📄 ${group.title}</h3>
      `;

      for (const item of group.items) {
        const icon = item.notificationType === 'new_suggestion_in_followed_document' ? '💡' :
                     item.notificationType === 'suggestion_status_changed' ? '✓' :
                     item.notificationType === 'reply_to_my_comment' ? '💬' :
                     item.notificationType === 'new_vote_on_suggestion' ? '👍' : '📌';

        const actionLink = item.actionUrl ? 
          `<a href="${item.actionUrl}" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">לצפייה ›</a>` : 
          '';
        
        const createdDate = new Date(item.created_date).toLocaleDateString('he-IL', { 
          day: 'numeric', 
          month: 'short', 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        emailBody += `
          <div style="margin: 12px 0; padding: 12px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-size: 20px; margin-bottom: 4px;">${icon}</div>
            <strong style="color: #1e293b; font-size: 15px;">${item.title}</strong><br/>
            <span style="color: #64748b; font-size: 14px;">${item.message}</span><br/>
            <span style="color: #94a3b8; font-size: 12px; margin-top: 4px; display: block;">${createdDate}</span>
            ${actionLink}
          </div>
        `;
      }

      emailBody += `</div>`;
    }

    emailBody += `
        <div style="margin-top: 30px; padding: 20px; background: #fef3c7; border-radius: 8px; border-right: 4px solid #f59e0b;">
          <strong style="color: #92400e;">⚠️ זהו דוא"ל בדיקה</strong><br/>
          <span style="color: #78350f; font-size: 14px;">דוא"ל זה נשלח כדי לבדוק את מערכת הדיוורים השבועיים.</span>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center;">
          <p>אתה מקבל דוא"ל זה כי אתה עוקב אחר מסמכים ב-Consenz</p>
          <p>נשלח על ידי <a href="https://consenz.io" style="color: #2563eb;">Consenz</a></p>
        </div>
      </div>
    `;

    // Send the email
    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'Consenz',
      to: email,
      subject: `🧪 [בדיקה] סיכום שבועי - ${lastWeekDigests.length} עדכונים`,
      body: emailBody
    });

    return Response.json({
      success: true,
      emailSent: true,
      digestCount: lastWeekDigests.length,
      recipient: email
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});