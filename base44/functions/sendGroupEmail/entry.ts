import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const buildAppUrl = (req) => {
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  if (origin) return origin.replace(/\/$/, '');
  return 'https://consenz-copy-4ca3772e.base44.app';
};

const joinRequestEmail = (language, userName, userEmail, groupName, manageUrl) => ({
  subject: language === 'he'
    ? `בקשת הצטרפות לקבוצה: ${groupName}`
    : language === 'ar'
    ? `طلب انضمام إلى مجموعة: ${groupName}`
    : `Request to join group: ${groupName}`,
  body: language === 'he'
    ? `שלום,\n\n${userName} מבקש/ת להצטרף לקבוצה "${groupName}".\n\nאימייל: ${userEmail}\n\nלניהול הבקשה:\n${manageUrl}`
    : language === 'ar'
    ? `مرحباً،\n\n${userName} يطلب الانضمام إلى مجموعة "${groupName}".\n\nالبريد الإلكتروني: ${userEmail}\n\nإدارة الطلب:\n${manageUrl}`
    : `Hello,\n\n${userName} wants to join "${groupName}".\n\nEmail: ${userEmail}\n\nManage request:\n${manageUrl}`,
});

const memberAddedEmail = (language, memberName, adminName, groupName) => ({
  subject: language === 'he'
    ? `נוספת לקבוצה: ${groupName}`
    : language === 'ar'
    ? `تمت إضافتك إلى المجموعة: ${groupName}`
    : `You were added to group: ${groupName}`,
  body: language === 'he'
    ? `שלום ${memberName},\n\n${adminName} הוסיף אותך לקבוצה "${groupName}".\n\nכעת תוכל לראות ולהשתתף במסמכים של הקבוצה.\n\nבברכה,\nצוות Consenz`
    : language === 'ar'
    ? `مرحباً ${memberName},\n\nقام ${adminName} بإضافتك إلى مجموعة "${groupName}".\n\nيمكنك الآن عرض مستندات المجموعة والمشاركة فيها.\n\nمع تحيات فريق Consenz`
    : `Hello ${memberName},\n\n${adminName} added you to the group "${groupName}".\n\nYou can now view and participate in the group's documents.\n\nBest regards,\nConsenz Team`,
});

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { type, groupId, language, memberEmail, memberName } = await req.json();
    if (!groupId) return Response.json({ error: 'Missing groupId' }, { status: 400 });

    const [group, members] = await Promise.all([
      base44.asServiceRole.entities.Group.filter({ id: groupId }).then(r => r[0]),
      base44.asServiceRole.entities.GroupMember.filter({ groupId }),
    ]);
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });

    const baseUrl = buildAppUrl(req);
    const lang = language || 'he';
    const userName = user.full_name || user.email?.split('@')[0] || 'משתמש';

    if (type === 'join_request') {
      const adminMembers = members.filter(m => m.role === 'admin');
      const adminProfiles = await base44.asServiceRole.entities.UserPublicProfile.filter({
        userId: { $in: adminMembers.map(m => m.userId) },
      });
      const manageUrl = `${baseUrl}/GroupView?id=${groupId}`;
      const { subject, body } = joinRequestEmail(lang, userName, user.email, group.name, manageUrl);

      await Promise.all(adminProfiles.map(admin =>
        base44.asServiceRole.integrations.Core.SendEmail({ to: admin.email, subject, body })
      ));
      return Response.json({ sent: adminProfiles.length });
    }

    if (type === 'member_added') {
      // Only a group admin can trigger "member added" notifications
      const isAdmin = members.some(m => m.role === 'admin' && m.userId === user.id) || user.role === 'admin';
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (!memberEmail) return Response.json({ error: 'Missing memberEmail' }, { status: 400 });

      // Validate email format — prevents malformed recipients being used as a relay
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(memberEmail).trim())) {
        return Response.json({ error: 'Invalid email address' }, { status: 400 });
      }

      // Verify the recipient is a registered app user AND an actual member of
      // this group — closes the open mail relay that previously let any group
      // admin send "you were added" emails to arbitrary third-party addresses.
      const memberUser = await base44.asServiceRole.entities.User
        .filter({ email: String(memberEmail).trim() })
        .then(r => r[0])
        .catch(() => null);
      if (!memberUser) {
        return Response.json({ error: 'Recipient is not a registered user' }, { status: 400 });
      }
      const isMember = members.some(m => m.userId === memberUser.id);
      if (!isMember) {
        return Response.json({ error: 'Recipient is not a member of this group' }, { status: 403 });
      }

      const adminName = user.full_name || 'מנהל';
      const name = memberName || memberUser.full_name || memberEmail.split('@')[0];
      const { subject, body } = memberAddedEmail(lang, name, adminName, group.name);
      await base44.asServiceRole.integrations.Core.SendEmail({ to: memberEmail, subject, body });
      return Response.json({ sent: 1 });
    }

    return Response.json({ error: 'Unknown email type' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}