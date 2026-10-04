import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, groupId } = body;

    if (!groupId || !action) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify caller is a group admin or system admin (using service role to bypass RLS)
    const members = await base44.asServiceRole.entities.GroupMember.filter({ groupId });
    const callerMember = members.find(m => m.userId === user.id);
    const isGroupAdmin = callerMember?.role === 'admin';
    const isSystemAdmin = user.role === 'admin';

    if (!isGroupAdmin && !isSystemAdmin) {
      return Response.json({ error: 'Forbidden — group admin required' }, { status: 403 });
    }

    if (action === 'toggleAdmin') {
      const { memberId, currentRole } = body;
      if (!memberId || !currentRole) {
        return Response.json({ error: 'Missing memberId or currentRole' }, { status: 400 });
      }
      // Verify the target member record belongs to the authorized group
      const targetMember = await base44.asServiceRole.entities.GroupMember.filter({ id: memberId }).then(m => m[0]);
      if (!targetMember || targetMember.groupId !== groupId) {
        return Response.json({ error: 'Member does not belong to this group' }, { status: 403 });
      }
      const newRole = currentRole === 'admin' ? 'member' : 'admin';
      await base44.asServiceRole.entities.GroupMember.update(memberId, { role: newRole });
      return Response.json({ success: true, newRole });
    }

    if (action === 'handleJoinRequest') {
      const { requestId, approved } = body;
      if (!requestId) {
        return Response.json({ error: 'Missing requestId' }, { status: 400 });
      }
      // Verify the join request belongs to the authorized group and derive
      // userId from the record itself — never trust the request body for userId
      const joinRequest = await base44.asServiceRole.entities.GroupJoinRequest.filter({ id: requestId }).then(r => r[0]);
      if (!joinRequest || joinRequest.groupId !== groupId) {
        return Response.json({ error: 'Join request does not belong to this group' }, { status: 403 });
      }
      const userId = joinRequest.userId;

      if (approved) {
        // Check if already a member to avoid duplicates
        const existing = members.find(m => m.userId === userId);
        if (!existing) {
          await base44.asServiceRole.entities.GroupMember.create({
            groupId,
            userId,
            role: 'member',
          });
        }

        // Send approval notification
        const group = await base44.asServiceRole.entities.Group.filter({ id: groupId }).then(g => g[0]);
        const groupName = group?.name || '';
        const translations = {
          en: { title: 'Join request approved!', message: `You have been accepted to the group "${groupName}"` },
          he: { title: 'בקשת ההצרפות אושרה!', message: `התקבלת לקבוצה "${groupName}"` },
          ar: { title: 'تمت الموافقة على طلب الانضمام!', message: `تم قبولك في المجموعة "${groupName}"` },
        };
        await base44.asServiceRole.entities.Notification.create({
          userId,
          type: 'group_join_request',
          title: translations.he.title,
          message: translations.he.message,
          translations,
          relatedEntityId: groupId,
          relatedEntityType: 'group',
          actionUrl: `/GroupView?id=${groupId}`,
          read: false,
        });
      }

      await base44.asServiceRole.entities.GroupJoinRequest.update(requestId, {
        status: approved ? 'approved' : 'rejected',
      });

      return Response.json({ success: true, approved });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('manageGroupMembership error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}