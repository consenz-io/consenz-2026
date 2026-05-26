import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Users } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function JoinGroupDialog({ isOpen, onClose, groupId, groupName: groupNameProp }) {
  const { language, isRTL } = useLanguage();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: groupData } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const groups = await base44.entities.Group.filter({ id: groupId });
      return groups[0] || null;
    },
    enabled: !!groupId,
  });

  const { data: groupMembers = [] } = useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => base44.entities.GroupMember.filter({ groupId }),
    enabled: !!groupId,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    staleTime: 5 * 60 * 1000,
  });

  const isPublicGroup = groupData?.status === 'public';
  const groupName = groupNameProp || groupData?.name || '';

  const joinMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.GroupMember.create({
        groupId,
        userId: user.id,
        role: 'member',
      });
    },
    onSuccess: () => {
      toast.success(language === 'he' ? 'הצטרפת לקבוצה בהצלחה!' : language === 'ar' ? 'انضممت إلى المجموعة بنجاح!' : 'You joined the group!');
      onClose();
      // Reload to reflect membership
      setTimeout(() => window.location.reload(), 500);
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: async () => {
      const admins = groupMembers.filter(m => m.role === 'admin');
      const adminProfiles = admins.map(admin =>
        publicProfiles.find(p => p.userId === admin.userId)
      ).filter(Boolean);

      const userName = user?.full_name || user?.email || 'משתמש';

      await base44.entities.GroupJoinRequest.create({
        groupId,
        userId: user.id,
        userEmail: user.email,
        userName,
        status: 'pending',
      });

      const manageUrl = `${window.location.origin}${createPageUrl("GroupView")}?id=${groupId}`;
      const subject = language === 'he'
        ? `בקשת הצטרפות לקבוצה: ${groupName}`
        : language === 'ar'
        ? `طلب انضمام إلى مجموعة: ${groupName}`
        : `Request to join group: ${groupName}`;
      const body = language === 'he'
        ? `שלום,\n\n${userName} מבקש/ת להצטרף לקבוצה "${groupName}".\n\nאימייל: ${user.email}\n\nלניהול הבקשה:\n${manageUrl}`
        : language === 'ar'
        ? `مرحباً،\n\n${userName} يطلب الانضمام إلى مجموعة "${groupName}".\n\nالبريد الإلكتروني: ${user.email}\n\nإدارة الطلب:\n${manageUrl}`
        : `Hello,\n\n${userName} wants to join "${groupName}".\n\nEmail: ${user.email}\n\nManage request:\n${manageUrl}`;

      await Promise.all([
        ...adminProfiles.map(admin =>
          base44.integrations.Core.SendEmail({ to: admin.email, subject, body })
        ),
        ...admins.map(admin =>
          base44.entities.Notification.create({
            userId: admin.userId,
            type: 'group_join_request',
            title: language === 'he' ? 'בקשת הצטרפות לקבוצה' : language === 'ar' ? 'طلب انضمام جديد' : 'New join request',
            message: language === 'he'
              ? `${userName} מבקש/ת להצטרף לקבוצה "${groupName}"`
              : language === 'ar'
              ? `${userName} يطلب الانضمام إلى مجموعة "${groupName}"`
              : `${userName} wants to join "${groupName}"`,
            relatedEntityId: groupId,
            relatedEntityType: 'document',
            actionUrl: createPageUrl("GroupView") + `?id=${groupId}`,
            read: false,
          })
        ),
      ]);
    },
    onSuccess: () => {
      toast.success(language === 'he' ? 'הבקשה נשלחה לאדמיני הקבוצה' : language === 'ar' ? 'تم إرسال الطلب إلى مديري المجموعة' : 'Request sent to group admins');
      onClose();
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            {language === 'he' ? 'הצטרף לקבוצה' : language === 'ar' ? 'انضم إلى المجموعة' : 'Join Group'}
          </DialogTitle>
          <DialogDescription>
            {language === 'he'
              ? `כדי להצביע על מסמכים בקבוצה "${groupName}", עליך להיות חבר בה.`
              : language === 'ar'
              ? `للتصويت على المستندات في مجموعة "${groupName}"، يجب أن تكون عضواً فيها.`
              : `To vote on documents in "${groupName}", you need to be a member.`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            {language === 'he' ? 'ביטול' : language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          {isPublicGroup ? (
            <Button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <Users className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {joinMutation.isPending
                ? (language === 'he' ? 'מצטרף...' : language === 'ar' ? 'جارٍ الانضمام...' : 'Joining...')
                : (language === 'he' ? 'הצטרף לקבוצה' : language === 'ar' ? 'انضم إلى المجموعة' : 'Join Group')}
            </Button>
          ) : (
            <Button
              onClick={() => requestAccessMutation.mutate()}
              disabled={requestAccessMutation.isPending || requestAccessMutation.isSuccess}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <Mail className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {requestAccessMutation.isSuccess
                ? (language === 'he' ? 'הבקשה נשלחה ✓' : language === 'ar' ? 'تم إرسال الطلب ✓' : 'Request sent ✓')
                : requestAccessMutation.isPending
                ? (language === 'he' ? 'שולח...' : language === 'ar' ? 'جارٍ الإرسال...' : 'Sending...')
                : (language === 'he' ? 'שלח בקשת הצטרפות' : language === 'ar' ? 'إرسال طلب انضمام' : 'Request to Join')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}