import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Accept group invitation after user signs up/logs in
 * Called automatically when user completes authentication with invitation token
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get token from request
    const { token } = await req.json();
    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find invitation
    const invitations = await base44.entities.GroupInvitation.filter({ token, status: 'pending' });
    if (invitations.length === 0) {
      return Response.json({ error: 'Invitation not found or already used' }, { status: 404 });
    }

    const invitation = invitations[0];

    // Verify email matches
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return Response.json({ 
        error: 'Email mismatch. This invitation is for ' + invitation.email 
      }, { status: 403 });
    }

    // Check if already a member
    const existingMemberships = await base44.entities.GroupMember.filter({
      groupId: invitation.groupId,
      userId: user.id
    });

    if (existingMemberships.length === 0) {
      // Add user to group
      await base44.entities.GroupMember.create({
        groupId: invitation.groupId,
        userId: user.id,
        role: 'member'
      });
    }

    // Mark invitation as accepted
    await base44.entities.GroupInvitation.update(invitation.id, {
      status: 'accepted'
    });

    return Response.json({
      success: true,
      groupId: invitation.groupId,
      message: 'Successfully joined group'
    });
  } catch (error) {
    console.error('Error accepting group invitation:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});