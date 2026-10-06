import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Trusted base URL — hardcoded, not derived from client-controlled request
// headers (Origin/Referer), to prevent phishing of group admins via forged
// headers that redirect the "Manage request" link to an attacker domain.
const APP_BASE_URL = 'https://consenz-copy-4ca3772e.base44.app';

// HTML-escape user-controlled strings before interpolating into email bodies.
// SendEmail treats `body` as HTML, so unescaped memberName / groupName / etc.
// would be rendered as markup by the recipient's mail client — enabling
// content spoofing / phishing from the app's verified sender.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

const joinRequestEmail = (language, userName, userEmail, groupName, manageUrl) => {
  const n = escapeHtml(userName);
  const e = escapeHtml(userEmail);
  const g = escapeHtml(groupName);
  return {
    subject: language === 'he'
      ? `בקשת הצטרפות לקבוצה: ${groupName}`
      : language === 'ar'
      ? `طلب انضمام إلى مجموعة: ${groupName}`
      : `Request to join group: ${groupName}`,
    body: language === 'he'
      ? `שלום,\n\n${n} מבקש/ת להצטרף לקבוצה "${g}".\n\nאימייל: ${e}\n\nלניהול הבקשה:\n${manageUrl}`
      : language === 'ar'
      ? `مرحباً،\n\n${n} يطلب الانضمام إلى مجموعة "${g}".\n\nالبريد الإلكتروني: ${e}\n\nإدارة الطلب:\n${manageUrl}`
      : `Hello,\n\n${n} wants to join "${g}".\n\nEmail: ${e}\n\nManage request:\n${manageUrl}`,
  };
};

const memberAddedEmail = (language, memberName, adminName, groupName) => {
  const m = escapeHtml(memberName);
  const a = escapeHtml(adminName);
  const g = escapeHtml(groupName);
  return {
    subject: language === 'he'
      ? `נוספת לקבוצה: ${groupName}`
      : language === 'ar'
      ? `تمت إضافتك إلى المجموعة: ${groupName}`
      : `You were added to group: ${groupName}`,
    body: language === 'he'
      ? `שלום ${m},\n\n${a} הוסיף אותך לקבוצה "${g}".\n\nכעת תוכל לראות ולהשתתף במסמכים של הקבוצה.\n\nבברכה,\nצוות Consenz`
      : language === 'ar'
      ? `مرحباً ${m},\n\nقام ${a} بإضافتك إلى مجموعة "${g}".\n\nيمكنك الآن عرض مستندات المجموعة والمشاركة فيها.\n\nمع تحيات فريق Consenz`
      : `Hello ${m},\n\n${a} added you to the group "${g}".\n\nYou can now view and participate in the group's documents.\n\nBest regards,\nConsenz Team`,
  };
};

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

    const baseUrl = APP_BASE_URL;
    const lang = language || 'he';
    const userName = user.full_name || user.email?.split('@')[0] || 'משתמש';

    if (type === 'join_request') {
      // Rate limit: max 5 join-request emails per user per hour — prevents
      // any authenticated user from mass-emailing arbitrary groups' admins.
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recentRequests = await base44.asServiceRole.entities.GroupJoinRequest.filter(
        { userId: user.id }, '-created_date', 10
      );
      const recentCount = recentRequests.filter(r => r.created_date && r.created_date >= oneHourAgo).length;
      if (recentCount >= 5) {
        return Response.json({ error: 'Rate limit exceeded: too many join requests' }, { status: 429 });
      }

      // One pending request per user per group — if a pending request already
      // exists, don't re-email admins (dedup). Otherwise persist the request
      // and notify.
      const existing = await base44.asServiceRole.entities.GroupJoinRequest.filter({ groupId, userId: user.id });
      const pending = existing.find(r => r.status === 'pending');
      if (pending) {
        return Response.json({ sent: 0, pending: true });
      }

      const adminMembers = members.filter(m => m.role === 'admin');
      const adminProfiles = await base44.asServiceRole.entities.UserPublicProfile.filter({
        userId: { $in: adminMembers.map(m => m.userId) },
      });
      const manageUrl = `${baseUrl}/GroupView?id=${groupId}`;
      const { subject, body } = joinRequestEmail(lang, userName, user.email, group.name, manageUrl);

      await base44.asServiceRole.entities.GroupJoinRequest.create({
        groupId, userId: user.id, userEmail: user.email, userName, status: 'pending',
      });
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