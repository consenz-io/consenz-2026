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

    // Helper function to delay between emails to avoid rate limiting
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Limit to max 10 emails per run to avoid rate limits
    const MAX_EMAILS_PER_RUN = 10;
    const userEntries = Object.entries(digestsByUser).slice(0, MAX_EMAILS_PER_RUN);

    // Send digest email to each user
    for (const [userId, digests] of userEntries) {
      try {
        const user = userMap[userId];
        if (!user || !user.email) {
          errors.push(`User ${userId} not found or has no email`);
          continue;
        }
        
        // Add 3 second delay between emails to avoid rate limiting
        if (emailsSent > 0) {
          await delay(3000);
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
        // Check if it's a rate limit error
        if (error.message.includes('Rate limit') || error.message.includes('rate limit')) {
          errors.push(`Rate limit hit for user ${userId}, will retry in next run`);
          // Don't mark as sent so it will be retried
        } else {
          errors.push(`Failed to send digest to user ${userId}: ${error.message}`);
          // Mark as sent even on error to avoid infinite retries
          for (const digest of digests) {
            await base44.asServiceRole.entities.EmailDigest.update(digest.id, {
              isIncludedInDigest: true
            }).catch(() => {});
          }
        }
      }
    }

    return Response.json({
      success: true,
      emailsSent,
      totalDigests: pendingDigests.length,
      totalUsers: Object.keys(digestsByUser).length,
      processedUsers: userEntries.length,
      remainingUsers: Math.max(0, Object.keys(digestsByUser).length - MAX_EMAILS_PER_RUN),
      errors: errors.length > 0 ? errors : undefined,
      message: Object.keys(digestsByUser).length > MAX_EMAILS_PER_RUN 
        ? `Sent ${emailsSent} emails. ${Object.keys(digestsByUser).length - MAX_EMAILS_PER_RUN} users remaining for next run.`
        : `Sent all ${emailsSent} emails.`
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});