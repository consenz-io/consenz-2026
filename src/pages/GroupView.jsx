import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, Lock, Globe, FileText, Plus, Settings, UserPlus, 
  AlertCircle, Trash2, Mail 
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "@/components/PageHeader";
import ManageMembersDialog from "@/components/group/ManageMembersDialog";

export default function GroupView() {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('id');
  const [showManageMembers, setShowManageMembers] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => base44.entities.Group.filter({ id: groupId }).then(groups => groups[0]),
    enabled: !!groupId,
  });

  const { data: groupMembers, isLoading: membersLoading } = useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => base44.entities.GroupMember.filter({ groupId }),
    initialData: [],
    enabled: !!groupId,
  });

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ['groupDocuments', groupId],
    queryFn: () => base44.entities.Document.filter({ groupId }, '-created_date'),
    initialData: [],
    enabled: !!groupId,
  });

  const { data: publicProfiles } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    initialData: [],
  });

  const isAdmin = currentUser && groupMembers.some(
    m => m.groupId === groupId && m.userId === currentUser.id && m.role === 'admin'
  );

  const isMember = currentUser && groupMembers.some(
    m => m.groupId === groupId && m.userId === currentUser.id
  );

  const joinGroupMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.GroupMember.create({
        groupId: group.id,
        userId: currentUser.id,
        role: 'member',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      const membership = groupMembers.find(
        m => m.userId === currentUser.id && m.groupId === groupId
      );
      if (membership) {
        await base44.entities.GroupMember.delete(membership.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      navigate(createPageUrl("Groups"));
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: async () => {
      const admins = groupMembers.filter(m => m.role === 'admin');
      const adminProfiles = admins.map(admin => 
        publicProfiles.find(p => p.userId === admin.userId)
      ).filter(Boolean);

      if (adminProfiles.length === 0) return;

      const userName = currentUser?.full_name || currentUser?.email || 'משתמש';
      
      // Create join request
      await base44.entities.GroupJoinRequest.create({
        groupId: group.id,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: userName,
        status: 'pending'
      });

      const manageUrl = `${window.location.origin}${createPageUrl("GroupView")}?id=${group.id}`;
      const subject = language === 'he' 
        ? `בקשת הצטרפות לקבוצה: ${group?.name}`
        : `Request to join group: ${group?.name}`;
      
      const body = language === 'he'
        ? `שלום,\n\n${userName} מבקש/ת להצטרף לקבוצה "${group?.name}".\n\nאימייל המשתמש: ${currentUser.email}\n\nכדי לאשר או לדחות את הבקשה, היכנס לעמוד ניהול החברים:\n${manageUrl}\n\nתודה!`
        : `Hello,\n\n${userName} would like to join the group "${group?.name}".\n\nUser email: ${currentUser.email}\n\nTo approve or reject this request, go to the member management page:\n${manageUrl}\n\nThank you!`;

      await Promise.all(
        adminProfiles.map(admin =>
          base44.integrations.Core.SendEmail({
            to: admin.email,
            subject,
            body,
          })
        )
      );
    },
  });

  if (groupLoading || membersLoading || documentsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {language === 'he' ? 'קבוצה לא נמצאה' : 'Group not found'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Check access for private and hidden groups
  const isCreator = currentUser && group.created_by === currentUser.email;
  const isSystemAdmin = currentUser && currentUser.role === 'admin';
  const canViewHidden = isMember || isCreator || isSystemAdmin;
  
  if (group.status === 'hidden' && !canViewHidden) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              {language === 'he' ? 'קבוצה חסויה - אינה זמינה' : 'Hidden group - not available'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }
  
  if (group.status === 'private' && !isMember) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              {language === 'he' ? 'קבוצה פרטית - נדרשת חברות' : 'Private group - membership required'}
            </AlertDescription>
          </Alert>
          
          {currentUser && (
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg">
                  {language === 'he' ? 'מעוניין להצטרף?' : 'Want to join?'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-600 text-sm">
                  {language === 'he' 
                    ? 'שלח בקשה לאדמיני הקבוצה והם יוכלו להוסיף אותך כחבר'
                    : 'Send a request to the group admins and they can add you as a member'}
                </p>
                <Button
                  onClick={() => requestAccessMutation.mutate()}
                  disabled={requestAccessMutation.isPending || requestAccessMutation.isSuccess}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  <Mail className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {requestAccessMutation.isSuccess 
                    ? (language === 'he' ? 'הבקשה נשלחה' : 'Request sent')
                    : (language === 'he' ? 'שלח בקשה להצטרפות' : 'Request to join')
                  }
                </Button>
                {requestAccessMutation.isSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">
                      {language === 'he' 
                        ? 'הבקשה נשלחה בהצלחה לאדמיני הקבוצה'
                        : 'Request sent successfully to group admins'}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <PageHeader 
              title={group.name}
              backUrl={createPageUrl("Groups")}
            />
            {group.description && (
              <p className="text-slate-600">{group.description}</p>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={
                group.status === 'private' 
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : group.status === 'hidden'
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }>
                {group.status === 'private' ? (
                  <>
                    <Lock className="w-3 h-3 mr-1" />
                    {language === 'he' ? 'פרטי' : 'Private'}
                  </>
                ) : group.status === 'hidden' ? (
                  <>
                    <Lock className="w-3 h-3 mr-1" />
                    {language === 'he' ? 'חסוי' : 'Hidden'}
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3 mr-1" />
                    {language === 'he' ? 'ציבורי' : 'Public'}
                  </>
                )}
              </Badge>
              <Badge variant="outline">
                <Users className="w-3 h-3 mr-1" />
                {groupMembers.length} {language === 'he' ? 'חברים' : 'members'}
              </Badge>
              {isAdmin && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                  {language === 'he' ? 'מנהל' : 'Admin'}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setShowManageMembers(true)}
              >
                <Settings className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'ניהול' : 'Manage'}
              </Button>
            )}
            {currentUser && !isMember && group.status === 'public' && (
              <Button
                onClick={() => joinGroupMutation.mutate()}
                disabled={joinGroupMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                <UserPlus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'הצטרף לקבוצה' : 'Join Group'}
              </Button>
            )}
            {isMember && !isAdmin && (
              <Button
                variant="outline"
                onClick={() => leaveGroupMutation.mutate()}
                disabled={leaveGroupMutation.isPending}
              >
                {language === 'he' ? 'עזוב קבוצה' : 'Leave Group'}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {language === 'he' ? 'מסמכי הקבוצה' : 'Group Documents'}
                  </CardTitle>
                  {isMember && (
                    <Link to={`${createPageUrl("CreateDocument")}?groupId=${groupId}`}>
                      <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <Plus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {language === 'he' ? 'מסמך חדש' : 'New Document'}
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">
                    {language === 'he' ? 'אין עדיין מסמכים בקבוצה זו' : 'No documents in this group yet'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <Link
                        key={doc.id}
                        to={`${createPageUrl("DocumentView")}?id=${doc.id}`}
                        className="block p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <h3 className="font-semibold text-slate-900">{doc.title}</h3>
                        {doc.description && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2" 
                             dangerouslySetInnerHTML={{ __html: doc.description }} 
                          />
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {language === 'he' ? 'חברי הקבוצה' : 'Members'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {groupMembers.map((member) => {
                    const profile = publicProfiles.find(p => p.userId === member.userId);
                    return (
                      <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {profile?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{profile?.fullName || member.userId}</p>
                          </div>
                        </div>
                        {member.role === 'admin' && (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                            {language === 'he' ? 'מנהל' : 'Admin'}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <ManageMembersDialog
          groupId={groupId}
          isOpen={showManageMembers}
          onClose={() => setShowManageMembers(false)}
        />
      </div>
    </div>
  );
}