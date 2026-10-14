import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { verifyGroupMembership } from '../../shared/documentAuth.ts';

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

    // Find invitation — use service role to bypass RLS, since link-based
    // invitations (empty email) would be unreadable by the accepting user
    const invitations = await base44.asServiceRole.entities.GroupInvitation.filter({ token, status: 'pending' });
    if (invitations.length === 0) {
      return Response.json({ error: 'Invitation not found or already used' }, { status: 404 });
    }

    const invitation = invitations[0];

    // Check if invitation expired
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return Response.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Verify email matches — only for email-based invitations (link-based
    // invitations have an empty email field and can be accepted by any user)
    if (invitation.email && invitation.email.trim() !== '' && invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return Response.json({ 
        error: 'Email mismatch. This invitation is for ' + invitation.email 
      }, { status: 403 });
    }

    // Link-based invitations (empty email) must have an expiry — prevents
    // never-expiring forged link invitations.
    const isLinkInvitation = !invitation.email || invitation.email.trim() === '';
    if (isLinkInvitation && !invitation.expiresAt) {
      return Response.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Provenance check: verify the inviter was authorized to invite people to
    // this group. GroupMember.create is open, so checking for ANY membership
    // record is insufficient — an attacker can self-mint one and then self-mint
    // a GroupInvitation. We only trust memberships established through verified
    // flows (created by the group creator, backed by an accepted invitation
    // with provenance, or backed by an approved join request), using
    // verifyGroupMembership from documentAuth.
    const [groupRecords, inviterUsers] = await Promise.all([
      base44.asServiceRole.entities.Group.filter({ id: invitation.groupId }),
      base44.asServiceRole.entities.User.filter({ id: invitation.created_by_id })
    ]);
    const group = groupRecords[0];
    if (!group) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    const inviter = inviterUsers[0];
    const isSystemAdmin = user.role === 'admin';
    const isGroupCreator = group.created_by_id === invitation.created_by_id;
    const isInviterSystemAdmin = inviter?.role === 'admin';

    let isInviterAuthorized = isGroupCreator || isInviterSystemAdmin;
    if (!isInviterAuthorized) {
      const { isMember } = await verifyGroupMembership(base44, group, {
        id: invitation.created_by_id,
        email: inviter?.email,
        role: inviter?.role
      });
      isInviterAuthorized = isMember;
    }

    if (!isSystemAdmin && !isInviterAuthorized) {
      return Response.json({ error: 'Invalid invitation' }, { status: 403 });
    }

    // Check if already a member — use service role to bypass RLS
    const existingMemberships = await base44.asServiceRole.entities.GroupMember.filter({
      groupId: invitation.groupId,
      userId: user.id
    });

    if (existingMemberships.length === 0) {
      // Add user to group
      await base44.asServiceRole.entities.GroupMember.create({
        groupId: invitation.groupId,
        userId: user.id,
        role: 'member'
      });
    }

    // Mark invitation as accepted — use service role to bypass RLS
    await base44.asServiceRole.entities.GroupInvitation.update(invitation.id, {
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