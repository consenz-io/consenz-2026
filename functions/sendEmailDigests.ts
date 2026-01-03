import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all pending email digests that haven't been sent yet
    const pendingDigests = await base44.asServiceRole.entities.EmailDigest.filter({
      isIncludedInDigest: false
    });

    if (pendingDigests.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No pending email digests to send',
        emailsSent: 0
      });
    }

    // Group digests by userId
    const digestsByUser = {};
    for (const digest of pendingDigests) {
      if (!digestsByUser[digest.userId]) {
        digestsByUser[digest.userId] = [];
      }
      digestsByUser[digest.userId].push(digest);
    }

    // Get all users to map userId to email
    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = {};
    allUsers.forEach(u => {
      userMap[u.id] = u;
    });

    let emailsSent = 0;
    const errors = [];

    // Send digest email to each user
    for (const [userId, digests] of Object.entries(digestsByUser)) {
      try {
        const user = userMap[userId];
        if (!user || !user.email) {
          errors.push(`User ${userId} not found or has no email`);
          continue;
        }

        // Group by document for better organization
        const byDocument = {};
        for (const d of digests) {
          const docKey = d.documentId || 'general';
          if (!byDocument[docKey]) {
            byDocument[docKey] = {
              title: d.documentTitle || 'General',
              items: []
            };
          }
          byDocument[docKey].items.push(d);
        }

        // Build email content
        let emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Consenz - Weekly Activity Digest</h2>
            <p>שלום ${user.full_name || user.email},</p>
            <p>הנה סיכום הפעילות מהשבוע האחרון:</p>
        `;

        for (const [docId, group] of Object.entries(byDocument)) {
          emailBody += `
            <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 8px;">
              <h3 style="color: #1e40af; margin-top: 0;">${group.title}</h3>
          `;

          for (const item of group.items) {
            const actionLink = item.actionUrl ? 
              `<a href="${item.actionUrl}" style="color: #2563eb; text-decoration: none;">לחץ כאן לצפייה ›</a>` : 
              '';
            
            emailBody += `
              <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
                <strong>${item.title}</strong><br/>
                <span style="color: #64748b;">${item.message}</span><br/>
                ${actionLink}
              </div>
            `;
          }

          emailBody += `</div>`;
        }

        emailBody += `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
              <p>אתה מקבל דוא"ל זה כי אתה עוקב אחר מסמכים ב-Consenz</p>
              <p>כדי לנהל את הגדרות הדוא"ל שלך, היכנס ל-<a href="https://consenz.io">Consenz</a></p>
            </div>
          </div>
        `;

        // Send the email
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'Consenz',
          to: user.email,
          subject: `סיכום שבועי - ${digests.length} עדכונים חדשים`,
          body: emailBody
        });

        // Mark all digests as sent
        for (const digest of digests) {
          await base44.asServiceRole.entities.EmailDigest.update(digest.id, {
            isIncludedInDigest: true
          });
        }

        emailsSent++;
      } catch (error) {
        errors.push(`Failed to send digest to user ${userId}: ${error.message}`);
      }
    }

    return Response.json({
      success: true,
      emailsSent,
      totalDigests: pendingDigests.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});