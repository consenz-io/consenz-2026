import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Send group invitation email
 * Uses service role to send emails to non-registered users
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

    // Generate unique token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Create invitation record using service role
    await base44.asServiceRole.entities.GroupInvitation.create({
      groupId,
      email: email.toLowerCase(),
      invitedBy: user.id,
      token,
      status: 'pending'
    });

    // Get current origin
    const origin = new URL(req.url).origin;
    const signupUrl = `${origin}/login?groupInvite=${token}`;
    
    // Detect language from user preference or default to Hebrew
    const language = user.language || 'he';
    
    // Send invitation email using service role
    const subject = language === 'he' 
      ? `הזמנה להצטרף לקבוצה: ${groupName}`
      : `Invitation to join group: ${groupName}`;
    
    const body = language === 'he'
      ? `שלום,\n\n${user.full_name || user.email} הזמין אותך להצטרף לקבוצה "${groupName}" בפלטפורמת Consenz.\n\nהקבוצה מאפשרת לך לשתף פעולה על מסמכים משותפים ולהשתתף בדיונים.\n\nכדי להצטרף, לחץ על הקישור הבא:\n${signupUrl}\n\nהקישור יכניס אותך ישירות לקבוצה לאחר ההרשמה.\n\nתודה!`
      : `Hello,\n\n${user.full_name || user.email} invited you to join the group "${groupName}" on the Consenz platform.\n\nThis group allows you to collaborate on shared documents and participate in discussions.\n\nTo join, click the following link:\n${signupUrl}\n\nThe link will automatically add you to the group after you sign up.\n\nThank you!`;

    // Send email using service role to bypass user restrictions
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject,
      body,
      from_name: 'Consenz'
    });

    return Response.json({ 
      success: true,
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Error sending group invitation:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});