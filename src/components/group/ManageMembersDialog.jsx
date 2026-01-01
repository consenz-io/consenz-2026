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
import { 
  UserPlus, Shield, ShieldOff, Trash2, Mail, 
  AlertCircle, CheckCircle 
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function ManageMembersDialog({ groupId, isOpen, onClose }) {
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
      if (users.length === 0) {
        throw new Error(language === 'he' ? 'משתמש לא נמצא במערכת' : 'User not found in system');
      }

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

      return user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      setSuccess(language === 'he' ? 'חבר נוסף בהצלחה!' : 'Member added successfully!');
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
            {language === 'he' ? 'ניהול חברי הקבוצה' : 'Manage Group Members'}
          </DialogTitle>
          <DialogDescription>
            {language === 'he' 
              ? 'הוסף חברים חדשים, הגדר אדמינים והסר חברים מהקבוצה'
              : 'Add new members, set admins, and remove members from the group'}
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
                ? 'משתמש חייב להיות רשום במערכת'
                : 'User must be registered in the system'}
            </p>
          </div>
        </form>

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