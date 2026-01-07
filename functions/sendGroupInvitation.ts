import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Send group invitation email via SendGrid
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request data
    const { groupId, email, groupName } = await req.json();
    
    if (!groupId || !email || !groupName) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate unique token with 7 days expiry
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Create invitation record using service role
    await base44.asServiceRole.entities.GroupInvitation.create({
      groupId,
      email: email.toLowerCase(),
      invitedBy: user.id,
      token,
      status: 'pending',
      expiresAt
    });

    // Get current origin
    const origin = new URL(req.url).origin;
    const signupUrl = `${origin}/login?groupInvite=${token}`;
    
    // Detect language from user preference or default to Hebrew
    const language = user.language || 'he';
    
    const subject = language === 'he' 
      ? `הזמנה להצטרף לקבוצה: ${groupName}`
      : `Invitation to join group: ${groupName}`;
    
    const emailHtml = language === 'he'
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>הזמנה להצטרף לקבוצה</h2>
          <p>${user.full_name || user.email} הזמין אותך להצטרף לקבוצה <strong>"${groupName}"</strong> בפלטפורמת Consenz.</p>
          <p>הקבוצה מאפשרת לך לשתף פעולה על מסמכים משותפים ולהשתתף בדיונים.</p>
          <p>
            <a href="${signupUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              הצטרף לקבוצה
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">ההזמנה תפוג תוך 7 ימים.</p>
          <p style="color: #666; font-size: 12px;">או העתק את הקישור: ${signupUrl}</p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Group Invitation</h2>
          <p>${user.full_name || user.email} invited you to join the group <strong>"${groupName}"</strong> on the Consenz platform.</p>
          <p>This group allows you to collaborate on shared documents and participate in discussions.</p>
          <p>
            <a href="${signupUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Join Group
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>
          <p style="color: #666; font-size: 12px;">Or copy this link: ${signupUrl}</p>
        </div>
      `;

    // Send email via external email function
    const emailResponse = await base44.functions.invoke('sendExternalEmail', {
      to: email,
      subject,
      html: emailHtml,
      purpose: 'group_invitation',
      relatedEntityId: groupId,
      relatedEntityType: 'group'
    });

    if (!emailResponse.data.success) {
      throw new Error(emailResponse.data.error || 'Failed to send invitation email');
    }

    return Response.json({ 
      success: true,
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Error sending group invitation:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});