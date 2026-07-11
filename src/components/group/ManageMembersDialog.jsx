import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  UserPlus, Shield, ShieldOff, Trash2, Mail,
  AlertCircle, CheckCircle, Lock, Globe, Pencil, Check
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { calcGroupParticipants } from "@/lib/groupParticipants";

export default function ManageMembersDialog({ groupId, isOpen, onClose, onGroupDeleted }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [groupNameValue, setGroupNameValue] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: groupMembers = [] } = useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => base44.entities.GroupMember.filter({ groupId }),
    enabled: !!groupId,
  });

  const { data: joinRequests = [] } = useQuery({
    queryKey: ['joinRequests', groupId],
    queryFn: () => base44.entities.GroupJoinRequest.filter({ groupId, status: 'pending' }),
    enabled: !!groupId && isOpen,
    initialData: [],
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
  });

  // Fetch group documents to find additional participants (suggestion creators)
  const { data: groupDocuments = [] } = useQuery({
    queryKey: ['groupDocuments', groupId],
    queryFn: () => base44.entities.Document.filter({ groupId }, '-created_date'),
    enabled: !!groupId && isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const docIds = useMemo(() => groupDocuments.map(d => d.id), [groupDocuments]);

  const { data: allDocSuggestions = [] } = useQuery({
    queryKey: ['groupAllSuggestions', groupId, docIds.join(',')],
    queryFn: async () => {
      if (docIds.length === 0) return [];
      const results = await Promise.all(
        docIds.map(id => base44.entities.Suggestion.filter({ documentId: id }, null, 200))
      );
      return results.flat();
    },
    enabled: docIds.length > 0 && isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const suggestionIds = useMemo(() => allDocSuggestions.map(s => s.id), [allDocSuggestions]);

  const { data: allDocVotes = [] } = useQuery({
    queryKey: ['groupAllVotes', groupId, suggestionIds.join(',')],
    queryFn: () => base44.entities.Vote.filter({ suggestionId: { $in: suggestionIds } }, null, 1000),
    enabled: suggestionIds.length > 0 && isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allDocSections = [] } = useQuery({
    queryKey: ['groupAllSections', groupId, docIds.join(',')],
    queryFn: () => base44.entities.Section.filter({ documentId: { $in: docIds } }, null, 500),
    enabled: docIds.length > 0 && isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const allRootEntityIds = useMemo(
    () => [...docIds, ...suggestionIds, ...allDocSections.map(s => s.id)],
    [docIds, suggestionIds, allDocSections]
  );

  const { data: allDocComments = [] } = useQuery({
    queryKey: ['groupAllComments', groupId, allRootEntityIds.join(',')],
    queryFn: () => base44.entities.Comment.filter({ rootEntityId: { $in: allRootEntityIds } }, null, 1000),
    enabled: allRootEntityIds.length > 0 && isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allDocAgreements = [] } = useQuery({
    queryKey: ['groupAllAgreements', groupId, docIds.join(',')],
    queryFn: () => base44.entities.DocumentAgreement.filter({ documentId: { $in: docIds } }, null, 500),
    enabled: docIds.length > 0 && isOpen,
    staleTime: 10 * 60 * 1000,
  });

  // Build the full participant list using the unified calcGroupParticipants
  const allParticipants = useMemo(() => {
    const emailToProfile = new Map();
    publicProfiles.forEach(p => { if (p.email) emailToProfile.set(p.email, p); });

    const memberUserIds = new Set(groupMembers.map(m => m.userId));

    // Collect suggestion creators who are not formal members (for the "extra" list in the UI)
    const extraProfiles = [];
    const seenEmails = new Set();
    allDocSuggestions.forEach(s => {
      if (s.created_by && !seenEmails.has(s.created_by)) {
        seenEmails.add(s.created_by);
        const profile = emailToProfile.get(s.created_by);
        if (profile && !memberUserIds.has(profile.userId)) {
          extraProfiles.push(profile);
        }
      }
    });

    // Total count uses the same unified function as all other views
    const totalCount = calcGroupParticipants(
      groupId, groupMembers, groupDocuments, allDocSuggestions, allDocVotes, allDocComments, publicProfiles, allDocAgreements, allDocSections
    ).size;

    return { extraProfiles, totalCount };
  }, [groupId, groupMembers, groupDocuments, publicProfiles, allDocSuggestions, allDocVotes, allDocComments, allDocAgreements, allDocSections]);

  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => base44.entities.Group.filter({ id: groupId }).then(groups => groups[0]),
    enabled: !!groupId,
  });

  // Compute isAdmin AFTER all queries — avoids false-negative during loading
  const isAdmin = !!(currentUser?.id && groupMembers.some(
    m => m.userId === currentUser.id && m.role === 'admin'
  ));

  const inviteMemberMutation = useMutation({
    mutationFn: async (email) => {
      const trimmedEmail = email.trim().toLowerCase();
      
      // Validate email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error(language === 'he' ? 'כתובת אימייל לא תקינה' : language === 'ar' ? 'عنوان البريد الإلكتروني غير صالح' : 'Invalid email address');
      }

      // Check if user exists
      const users = await base44.entities.User.filter({ email: trimmedEmail });
      
      if (users.length > 0) {
        // User exists - add directly
        const user = users[0];

        // Check if already a member
        const existingMember = groupMembers.find(m => m.userId === user.id);
        if (existingMember) {
          throw new Error(language === 'he' ? 'משתמש כבר חבר בקבוצה' : language === 'ar' ? 'المستخدم عضو بالفعل في المجموعة' : 'User is already a member');
        }

        // Add as member
        await base44.entities.GroupMember.create({
          groupId,
          userId: user.id,
          role: 'member',
        });

        // Send email notification
        try {
          const groupName = group?.name || 'קבוצה';
          const adminName = currentUser?.full_name || 'מנהל';
          
          await base44.integrations.Core.SendEmail({
            to: trimmedEmail,
            subject: language === 'he' 
              ? `נוספת לקבוצה: ${groupName}`
              : language === 'ar'
              ? `تمت إضافتك إلى المجموعة: ${groupName}`
              : `You were added to group: ${groupName}`,
            body: language === 'he'
              ? `שלום ${user.full_name},\n\n${adminName} הוסיף אותך לקבוצה "${groupName}".\n\nכעת תוכל לראות ולהשתתף במסמכים של הקבוצה.\n\nבברכה,\nצוות Consenz`
              : language === 'ar'
              ? `مرحباً ${user.full_name},\n\nقام ${adminName} بإضافتك إلى مجموعة "${groupName}".\n\nيمكنك الآن عرض مستندات المجموعة والمشاركة فيها.\n\nمع تحيات فريق Consenz`
              : `Hello ${user.full_name},\n\n${adminName} added you to the group "${groupName}".\n\nYou can now view and participate in the group's documents.\n\nBest regards,\nConsenz Team`
          });
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
        }

        return { type: 'existing_user', user };
      } else {
        // User not registered - send invitation email
        const groupName = group?.name || 'קבוצה';
        
        const response = await base44.functions.invoke('sendGroupInvitation', {
          groupId,
          email: trimmedEmail,
          groupName
        });

        if (!response.data.success) {
          throw new Error(response.data.error || (language === 'he' ? 'שגיאה בשליחת הזמנה' : language === 'ar' ? 'خطأ في إرسال الدعوة' : 'Error sending invitation'));
        }

        return { type: 'invitation_sent', email: trimmedEmail };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groupInvitations', groupId] });
      
      if (result.type === 'existing_user') {
        setSuccess(language === 'he' ? 'חבר נוסף בהצלחה!' : language === 'ar' ? 'تمت إضافة العضو بنجاح!' : 'Member added successfully!');
      } else {
        setSuccess(language === 'he' ? 'הזמנה נשלחה בהצלחה במייל!' : language === 'ar' ? 'تم إرسال الدعوة بنجاح عبر البريد الإلكتروني!' : 'Invitation sent successfully via email!');
      }
      
      setInviteEmail("");
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ memberId, currentRole }) => {
      const newRole = currentRole === 'admin' ? 'member' : 'admin';
      await base44.entities.GroupMember.update(memberId, { role: newRole });
      return newRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      await base44.entities.GroupMember.delete(memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
    },
  });

  const handleJoinRequestMutation = useMutation({
    mutationFn: async ({ requestId, approved, userId }) => {
      if (approved) {
        await base44.entities.GroupMember.create({
          groupId,
          userId,
          role: 'member',
        });

        // Notify the user that their request was approved
        const groupName = group?.name || '';
        const joinApprovedTranslations = {
          en: { title: 'Join request approved!', message: `You have been accepted to the group "${groupName}" - you can now view and participate in the group's documents` },
          he: { title: 'בקשת ההצטרפות אושרה!', message: `התקבלת לקבוצה "${groupName}" - עכשיו תוכל לצפות ולהשתתף במסמכי הקבוצה` },
          ar: { title: 'تمت الموافقة على طلب الانضمام!', message: `تم قبولك في المجموعة "${groupName}" - يمكنك الآن عرض المستندات والمشاركة فيها` },
        };
        await base44.entities.Notification.create({
          userId,
          type: 'group_join_request',
          title: joinApprovedTranslations.he.title,
          message: joinApprovedTranslations.he.message,
          translations: joinApprovedTranslations,
          relatedEntityId: groupId,
          relatedEntityType: 'document',
          actionUrl: `/GroupView?id=${groupId}`,
          read: false,
        });
      }
      await base44.entities.GroupJoinRequest.update(requestId, {
        status: approved ? 'approved' : 'rejected'
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      queryClient.invalidateQueries({ queryKey: ['joinRequests', groupId] });
      const message = variables.approved 
        ? (language === 'he' ? 'הבקשה אושרה והמשתמש נוסף לקבוצה' : language === 'ar' ? 'تمت الموافقة على الطلب وإضافة المستخدم' : 'Request approved and user added')
        : (language === 'he' ? 'הבקשה נדחתה' : language === 'ar' ? 'تم رفض الطلب' : 'Request rejected');
      setSuccess(message);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: () => {
      setError(language === 'he' ? 'שגיאה בטיפול בבקשה' : language === 'ar' ? 'خطأ في معالجة الطلب' : 'Error handling request');
      setTimeout(() => setError(null), 5000);
    },
  });

  const updateGroupNameMutation = useMutation({
    mutationFn: async (newName) => {
      await base44.entities.Group.update(groupId, { name: newName.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setEditingName(false);
      setSuccess(language === 'he' ? 'שם הקבוצה עודכן בהצלחה' : language === 'ar' ? 'تم تحديث اسم المجموعة بنجاح' : 'Group name updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: () => {
      setError(language === 'he' ? 'שגיאה בעדכון שם הקבוצה' : language === 'ar' ? 'خطأ في تحديث اسم المجموعة' : 'Error updating group name');
      setTimeout(() => setError(null), 5000);
    },
  });

  const updateGroupStatusMutation = useMutation({
    mutationFn: async (newStatus) => {
      await base44.entities.Group.update(groupId, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setSuccess(language === 'he' ? 'הגדרות הקבוצה עודכנו בהצלחה' : language === 'ar' ? 'تم تحديث إعدادات المجموعة بنجاح' : 'Group settings updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: () => {
      setError(language === 'he' ? 'שגיאה בעדכון הגדרות הקבוצה' : language === 'ar' ? 'خطأ في تحديث إعدادات المجموعة' : 'Error updating group settings');
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMemberMutation.mutate(inviteEmail);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {language === 'he' ? 'ניהול הקבוצה' : language === 'ar' ? 'إدارة المجموعة' : 'Manage Group'}
          </DialogTitle>
          <DialogDescription>
            {language === 'he' 
              ? 'נהל את הגדרות הקבוצה, הוסף חברים חדשים והגדר אדמינים'
              : language === 'ar'
              ? 'إدارة إعدادات المجموعة وإضافة أعضاء جدد وتعيين المديرين'
              : 'Manage group settings, add new members and set admins'}
          </DialogDescription>
        </DialogHeader>

        {/* Guard: currentUser not yet loaded — show spinner instead of blank/null */}
        {!currentUser ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
          </div>
        ) : !isAdmin ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{language === 'he' ? 'אין הרשאת ניהול לקבוצה זו' : language === 'ar' ? 'لا توجد صلاحية إدارة لهذه المجموعة' : 'No admin permission for this group'}</AlertDescription>
          </Alert>
        ) : (<>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 border-b pb-4">
          <h3 className="font-semibold text-sm text-slate-700">
            {language === 'he' ? 'הגדרות קבוצה' : language === 'ar' ? 'إعدادات المجموعة' : 'Group Settings'}
          </h3>
          <div className="space-y-2">
            <Label>{language === 'he' ? 'שם הקבוצה' : language === 'ar' ? 'اسم المجموعة' : 'Group Name'}</Label>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={groupNameValue}
                  onChange={(e) => setGroupNameValue(e.target.value)}
                  placeholder={language === 'he' ? 'הזן שם קבוצה...' : language === 'ar' ? 'أدخل اسم المجموعة...' : 'Enter group name...'}
                />
                <Button
                  size="sm"
                  disabled={updateGroupNameMutation.isPending || !groupNameValue.trim()}
                  onClick={() => updateGroupNameMutation.mutate(groupNameValue)}
                >
                  <Check className="w-4 h-4 mr-1" />
                  {language === 'he' ? 'שמור' : language === 'ar' ? 'حفظ' : 'Save'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingName(false)}
                >
                  {language === 'he' ? 'בטל' : language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{group?.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setGroupNameValue(group?.name || ''); setEditingName(true); }}
                  title={language === 'he' ? 'ערוך שם' : language === 'ar' ? 'تعديل الاسم' : 'Edit name'}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>{language === 'he' ? 'פרטיות הקבוצה' : language === 'ar' ? 'خصوصية المجموعة' : 'Group Privacy'}</Label>
            <RadioGroup
              value={group?.status || 'public'}
              onValueChange={(value) => updateGroupStatusMutation.mutate(value)}
            >
              <div className="flex items-start flex-row-reverse gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="public" id="public-manage" />
                <Label htmlFor="public-manage" className="flex-1 cursor-pointer text-right">
                  <div className="flex items-center justify-end gap-2 font-medium mb-1">
                    <Globe className="w-4 h-4" />
                    {language === 'he' ? 'ציבורי' : language === 'ar' ? 'عام' : 'Public'}
                  </div>
                  <p className="text-xs text-slate-500">
                    {language === 'he' ? 'כולם יכולים לראות ולהצטרף' : language === 'ar' ? 'يمكن للجميع الرؤية والانضمام' : 'Everyone can see and join'}
                  </p>
                </Label>
              </div>

              <div className="flex items-start flex-row-reverse gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="private" id="private-manage" />
                <Label htmlFor="private-manage" className="flex-1 cursor-pointer text-right">
                  <div className="flex items-center justify-end gap-2 font-medium mb-1">
                    <Lock className="w-4 h-4" />
                    {language === 'he' ? 'פרטי' : language === 'ar' ? 'خاص' : 'Private'}
                  </div>
                  <p className="text-xs text-slate-500">
                    {language === 'he' ? 'כולם יכולים לראות, דרושה אישור' : language === 'ar' ? 'يمكن للجميع الرؤية، يتطلب موافقة' : 'Everyone can see, approval required'}
                  </p>
                </Label>
              </div>

              <div className="flex items-start flex-row-reverse gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="hidden" id="hidden-manage" />
                <Label htmlFor="hidden-manage" className="flex-1 cursor-pointer text-right">
                  <div className="flex items-center justify-end gap-2 font-medium mb-1">
                    <Lock className="w-4 h-4" />
                    {language === 'he' ? 'חסוי' : language === 'ar' ? 'مخفي' : 'Hidden'}
                  </div>
                  <p className="text-xs text-slate-500">
                    {language === 'he' ? 'רק חברים ומנהלי מערכת' : language === 'ar' ? 'الأعضاء ومديرو النظام فقط' : 'Only members and system admins'}
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {joinRequests.length > 0 && (
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-sm text-blue-900">
              {language === 'he' ? 'בקשות הצטרפות ממתינות' : language === 'ar' ? 'طلبات الانضمام المعلّقة' : 'Pending Join Requests'}
            </h3>
            <div className="space-y-2">
              {joinRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {request.userName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{request.userName}</p>
                      <p className="text-xs text-slate-500">{request.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      onClick={() => handleJoinRequestMutation.mutate({ 
                        requestId: request.id, 
                        approved: true,
                        userId: request.userId 
                      })}
                      disabled={handleJoinRequestMutation.isPending}
                    >
                      {language === 'he' ? 'אשר' : language === 'ar' ? 'موافقة' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      onClick={() => handleJoinRequestMutation.mutate({ 
                        requestId: request.id, 
                        approved: false,
                        userId: request.userId 
                      })}
                      disabled={handleJoinRequestMutation.isPending}
                    >
                      {language === 'he' ? 'דחה' : language === 'ar' ? 'رفض' : 'Reject'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleInvite} className="space-y-4 border-b pb-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">
              {language === 'he' ? 'הזמן חבר חדש' : language === 'ar' ? 'دعوة عضو جديد' : 'Invite New Member'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder={language === 'he' ? 'הזן כתובת אימייל...' : language === 'ar' ? 'أدخل عنوان البريد الإلكتروني...' : 'Enter email address...'}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button
                type="submit"
                disabled={inviteMemberMutation.isPending || !inviteEmail.trim()}
              >
                <Mail className="w-4 h-4 mr-2" />
                {language === 'he' ? 'הזמן' : language === 'ar' ? 'دعوة' : 'Invite'}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              {language === 'he' 
                ? 'אם המשתמש לא רשום, ישלח לו מייל הזמנה'
                : language === 'ar'
                ? 'إذا لم يكن المستخدم مسجلاً، سيتلقى بريداً إلكترونياً بالدعوة'
                : 'If user is not registered, they will receive an invitation email'}
            </p>
          </div>
        </form>

        <div className="space-y-3 border-b pb-4">
          <h3 className="font-semibold text-sm text-red-700">
            {language === 'he' ? 'מחיקת קבוצה' : language === 'ar' ? 'حذف المجموعة' : 'Delete Group'}
          </h3>
          <p className="text-xs text-slate-500">
            {language === 'he' ? 'פעולה זו אינה הפיכה. כל הנתונים יימחקו לצמיתות.' : language === 'ar' ? 'هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع البيانات نهائياً.' : 'This action is irreversible. All data will be permanently deleted.'}
          </p>
          {confirmDeleteGroup ? (
            <div className="flex items-center gap-2">
              <p className="text-xs text-red-600">{language === 'he' ? 'האם אתה בטוח?' : language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?'}</p>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={async () => {
                  await base44.entities.Group.delete(groupId);
                  onClose();
                  onGroupDeleted?.();
                }}
              >
                {language === 'he' ? 'אשר מחיקה' : language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteGroup(false)}>
                {language === 'he' ? 'בטל' : language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setConfirmDeleteGroup(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {language === 'he' ? 'מחק קבוצה' : language === 'ar' ? 'حذف المجموعة' : 'Delete Group'}
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-slate-700">
            {language === 'he' ? 'חברי הקבוצה' : language === 'ar' ? 'أعضاء المجموعة' : 'Group Members'} ({allParticipants.totalCount} {language === 'he' ? 'משתתפים' : language === 'ar' ? 'مشاركون' : 'participants'})
          </h3>
          
          {groupMembers.map((member) => {
            const profile = publicProfiles.find(p => p.userId === member.userId);
            const isCurrentUser = member.userId === currentUser?.id;
            
            return (
              <div 
                key={member.id} 
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-medium">
                    {profile?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">
                      {profile?.fullName || member.userId}
                      {isCurrentUser && (
                        <span className="text-xs text-slate-500 mr-2">
                          ({language === 'he' ? 'את/ה' : language === 'ar' ? 'أنت' : 'You'})
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">{profile?.email}</p>
                  </div>
                  {member.role === 'admin' && (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                      {language === 'he' ? 'מנהל' : language === 'ar' ? 'مدير' : 'Admin'}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isCurrentUser && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAdminMutation.mutate({
                          memberId: member.id,
                          currentRole: member.role,
                        })}
                        disabled={toggleAdminMutation.isPending}
                        title={member.role === 'admin' 
                          ? (language === 'he' ? 'הורד מאדמין' : language === 'ar' ? 'إزالة صلاحية المدير' : 'Remove admin')
                          : (language === 'he' ? 'הפוך לאדמין' : language === 'ar' ? 'تعيين كمدير' : 'Make admin')
                        }
                      >
                        {member.role === 'admin' ? (
                          <>
                            <ShieldOff className="w-4 h-4 mr-1" />
                            {language === 'he' ? 'יוזר' : language === 'ar' ? 'مستخدم' : 'User'}
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-1" />
                            {language === 'he' ? 'אדמין' : language === 'ar' ? 'مدير' : 'Admin'}
                          </>
                        )}
                      </Button>
                      {confirmRemoveMemberId === member.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 text-xs px-2"
                            onClick={() => { removeMemberMutation.mutate(member.id); setConfirmRemoveMemberId(null); }}
                            disabled={removeMemberMutation.isPending}
                          >
                            {language === 'he' ? 'אשר' : language === 'ar' ? 'تأكيد' : 'Confirm'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 text-xs px-2"
                            onClick={() => setConfirmRemoveMemberId(null)}
                          >
                            {language === 'he' ? 'בטל' : language === 'ar' ? 'إلغاء' : 'Cancel'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRemoveMemberId(member.id)}
                          disabled={removeMemberMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title={language === 'he' ? 'הסר מהקבוצה' : language === 'ar' ? 'إزالة من المجموعة' : 'Remove from group'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Additional participants (not formal members) */}
          {allParticipants.extraProfiles.length > 0 && (
            <>
              <p className="text-xs text-slate-400 pt-2 border-t">
                {language === 'he' ? 'משתתפים נוספים (הגישו הצעות)' : language === 'ar' ? 'مشاركون إضافيون (قدّموا اقتراحات)' : 'Additional participants (submitted suggestions)'}
              </p>
              {allParticipants.extraProfiles.map((profile) => (
                <div
                  key={profile.userId}
                  className="flex items-center justify-between p-3 rounded-lg border border-dashed hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white font-medium">
                      {profile.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{profile.fullName}</p>
                      <p className="text-sm text-slate-500">{profile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await base44.entities.GroupMember.create({ groupId, userId: profile.userId, role: 'member' });
                        queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
                      }}
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      {language === 'he' ? 'הוסף כחבר' : language === 'ar' ? 'إضافة كعضو' : 'Add as member'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-purple-700 border-purple-200 hover:bg-purple-50"
                      onClick={async () => {
                        await base44.entities.GroupMember.create({ groupId, userId: profile.userId, role: 'admin' });
                        queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
                      }}
                    >
                      <Shield className="w-4 h-4 mr-1" />
                      {language === 'he' ? 'הפוך לאדמין' : language === 'ar' ? 'تعيين كمدير' : 'Make admin'}
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        </>)}
      </DialogContent>
    </Dialog>
  );
}