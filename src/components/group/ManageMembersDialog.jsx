import React, { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { 
  UserPlus, Shield, ShieldOff, Trash2, Mail, 
  AlertCircle, CheckCircle, Lock, Globe 
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function ManageMembersDialog({ groupId, isOpen, onClose, onGroupDeleted }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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

  const isAdmin = groupMembers.some(
    m => m.userId === currentUser?.id && m.role === 'admin'
  );

  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => base44.entities.Group.filter({ id: groupId }).then(groups => groups[0]),
    enabled: !!groupId,
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async (email) => {
      const trimmedEmail = email.trim().toLowerCase();
      
      // Validate email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error(language === 'he' ? 'כתובת אימייל לא תקינה' : 'Invalid email address');
      }

      // Check if user exists
      const users = await base44.entities.User.filter({ email: trimmedEmail });
      
      if (users.length > 0) {
        // User exists - add directly
        const user = users[0];

        // Check if already a member
        const existingMember = groupMembers.find(m => m.userId === user.id);
        if (existingMember) {
          throw new Error(language === 'he' ? 'משתמש כבר חבר בקבוצה' : 'User is already a member');
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
              : `You were added to group: ${groupName}`,
            body: language === 'he'
              ? `שלום ${user.full_name},\n\n${adminName} הוסיף אותך לקבוצה "${groupName}".\n\nכעת תוכל לראות ולהשתתף במסמכים של הקבוצה.\n\nבברכה,\nצוות Consenz`
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
          throw new Error(response.data.error || (language === 'he' ? 'שגיאה בשליחת הזמנה' : 'Error sending invitation'));
        }

        return { type: 'invitation_sent', email: trimmedEmail };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groupInvitations', groupId] });
      
      if (result.type === 'existing_user') {
        setSuccess(language === 'he' ? 'חבר נוסף בהצלחה!' : 'Member added successfully!');
      } else {
        setSuccess(language === 'he' ? 'הזמנה נשלחה בהצלחה במייל!' : 'Invitation sent successfully via email!');
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
        ? (language === 'he' ? 'הבקשה אושרה והמשתמש נוסף לקבוצה' : 'Request approved and user added')
        : (language === 'he' ? 'הבקשה נדחתה' : 'Request rejected');
      setSuccess(message);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: () => {
      setError(language === 'he' ? 'שגיאה בטיפול בבקשה' : 'Error handling request');
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
      setSuccess(language === 'he' ? 'הגדרות הקבוצה עודכנו בהצלחה' : 'Group settings updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: () => {
      setError(language === 'he' ? 'שגיאה בעדכון הגדרות הקבוצה' : 'Error updating group settings');
      setTimeout(() => setError(null), 5000);
    },
  });

  const updateFreeDocCreationMutation = useMutation({
    mutationFn: async (value) => {
      await base44.entities.Group.update(groupId, { freeDocumentCreation: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      setSuccess(language === 'he' ? 'הגדרות הקבוצה עודכנו בהצלחה' : 'Group settings updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMemberMutation.mutate(inviteEmail);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {language === 'he' ? 'ניהול הקבוצה' : 'Manage Group'}
          </DialogTitle>
          <DialogDescription>
            {language === 'he' 
              ? 'נהל את הגדרות הקבוצה, הוסף חברים חדשים והגדר אדמינים'
              : 'Manage group settings, add new members and set admins'}
          </DialogDescription>
        </DialogHeader>

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
            {language === 'he' ? 'הגדרות קבוצה' : 'Group Settings'}
          </h3>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {language === 'he' ? 'יצירת מסמכים ללא עלות' : 'Free Document Creation'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'he' ? 'חברי הקבוצה יוכלו לפתוח מסמכים חדשים ללא עלות של 1001 נקודות' : 'Group members can create documents without spending 1001 points'}
              </p>
            </div>
            <Switch
              checked={group?.freeDocumentCreation || false}
              onCheckedChange={(val) => updateFreeDocCreationMutation.mutate(val)}
              disabled={updateFreeDocCreationMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>{language === 'he' ? 'פרטיות הקבוצה' : 'Group Privacy'}</Label>
            <RadioGroup
              value={group?.status || 'public'}
              onValueChange={(value) => updateGroupStatusMutation.mutate(value)}
            >
              <div className="flex items-start space-x-3 space-x-reverse p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="public" id="public-manage" />
                <Label htmlFor="public-manage" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <Globe className="w-4 h-4" />
                    {language === 'he' ? 'ציבורי' : 'Public'}
                  </div>
                  <p className="text-xs text-slate-500">
                    {language === 'he' ? 'כולם יכולים לראות ולהצטרף' : 'Everyone can see and join'}
                  </p>
                </Label>
              </div>

              <div className="flex items-start space-x-3 space-x-reverse p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="private" id="private-manage" />
                <Label htmlFor="private-manage" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <Lock className="w-4 h-4" />
                    {language === 'he' ? 'פרטי' : 'Private'}
                  </div>
                  <p className="text-xs text-slate-500">
                    {language === 'he' ? 'כולם יכולים לראות, דרושה אישור' : 'Everyone can see, approval required'}
                  </p>
                </Label>
              </div>

              <div className="flex items-start space-x-3 space-x-reverse p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="hidden" id="hidden-manage" />
                <Label htmlFor="hidden-manage" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <Lock className="w-4 h-4" />
                    {language === 'he' ? 'חסוי' : 'Hidden'}
                  </div>
                  <p className="text-xs text-slate-500">
                    {language === 'he' ? 'רק חברים ומנהלי מערכת' : 'Only members and system admins'}
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {joinRequests.length > 0 && (
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-sm text-blue-900">
              {language === 'he' ? 'בקשות הצטרפות ממתינות' : 'Pending Join Requests'}
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
                      {language === 'he' ? 'אשר' : 'Approve'}
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
                      {language === 'he' ? 'דחה' : 'Reject'}
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
              {language === 'he' ? 'הזמן חבר חדש' : 'Invite New Member'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder={language === 'he' ? 'הזן כתובת אימייל...' : 'Enter email address...'}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button
                type="submit"
                disabled={inviteMemberMutation.isPending || !inviteEmail.trim()}
              >
                <Mail className="w-4 h-4 mr-2" />
                {language === 'he' ? 'הזמן' : 'Invite'}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              {language === 'he' 
                ? 'אם המשתמש לא רשום, ישלח לו מייל הזמנה'
                : 'If user is not registered, they will receive an invitation email'}
            </p>
          </div>
        </form>

        <div className="space-y-3 border-b pb-4">
          <h3 className="font-semibold text-sm text-red-700">
            {language === 'he' ? 'מחיקת קבוצה' : 'Delete Group'}
          </h3>
          <p className="text-xs text-slate-500">
            {language === 'he' ? 'פעולה זו אינה הפיכה. כל הנתונים יימחקו לצמיתות.' : 'This action is irreversible. All data will be permanently deleted.'}
          </p>
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={async () => {
              if (!confirm(language === 'he' ? 'האם למחוק את הקבוצה לצמיתות? פעולה זו אינה הפיכה.' : 'Permanently delete this group? This cannot be undone.')) return;
              await base44.entities.Group.delete(groupId);
              onClose();
              onGroupDeleted?.();
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {language === 'he' ? 'מחק קבוצה' : 'Delete Group'}
          </Button>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-slate-700">
            {language === 'he' ? 'חברי הקבוצה' : 'Group Members'} ({groupMembers.length})
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
                          ({language === 'he' ? 'את/ה' : 'You'})
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">{profile?.email}</p>
                  </div>
                  {member.role === 'admin' && (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                      {language === 'he' ? 'מנהל' : 'Admin'}
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
                          ? (language === 'he' ? 'הורד מאדמין' : 'Remove admin')
                          : (language === 'he' ? 'הפוך לאדמין' : 'Make admin')
                        }
                      >
                        {member.role === 'admin' ? (
                          <>
                            <ShieldOff className="w-4 h-4 mr-1" />
                            {language === 'he' ? 'יוזר' : 'User'}
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-1" />
                            {language === 'he' ? 'אדמין' : 'Admin'}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(
                            language === 'he' 
                              ? 'האם אתה בטוח שברצונך להסיר חבר זה?' 
                              : 'Are you sure you want to remove this member?'
                          )) {
                            removeMemberMutation.mutate(member.id);
                          }
                        }}
                        disabled={removeMemberMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title={language === 'he' ? 'הסר מהקבוצה' : 'Remove from group'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}