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
  AlertCircle, Trash2, Mail, Bell, Languages, Loader2
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "@/components/PageHeader";
import ManageMembersDialog from "@/components/group/ManageMembersDialog";
import InviteMemberDialog from "@/components/group/InviteMemberDialog";
import { calculateContributorsFromData } from "@/components/document/calculateContributors";

export default function GroupView() {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('id');
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [translations, setTranslations] = useState({});
  const [translating, setTranslating] = useState({});

  const languageNames = { en: 'English', he: 'Hebrew', ar: 'Arabic' };

  const translateText = async (key, text) => {
    if (!text || translating[key]) return;
    if (translations[key]) {
      // Toggle off
      setTranslations(prev => { const n = {...prev}; delete n[key]; return n; });
      return;
    }
    setTranslating(prev => ({ ...prev, [key]: true }));
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following text to ${languageNames[language] || 'English'}. Return ONLY the translated text, no explanations:\n${text}`,
      });
      const translated = typeof result === 'string' ? result : result?.content || result;
      setTranslations(prev => ({ ...prev, [key]: translated.trim() }));
    } finally {
      setTranslating(prev => { const n = {...prev}; delete n[key]; return n; });
    }
  };

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

  const { data: groupMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => base44.entities.GroupMember.filter({ groupId }),
    enabled: !!groupId,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['groupDocuments', groupId],
    queryFn: () => base44.entities.Document.filter({ groupId }, '-created_date'),
    enabled: !!groupId,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
  });

  // Fetch data needed for participant count calculation
  const { data: allSuggestions = [] } = useQuery({
    queryKey: ['allSuggestions'],
    queryFn: () => base44.entities.Suggestion.list(),
  });

  const { data: allVotes = [] } = useQuery({
    queryKey: ['allVotes'],
    queryFn: () => base44.entities.Vote.list(),
  });

  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments'],
    queryFn: () => base44.entities.Comment.list(),
  });

  const { data: allSections = [] } = useQuery({
    queryKey: ['allSections'],
    queryFn: () => base44.entities.Section.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
    retry: false,
    throwOnError: false,
    enabled: !!currentUser && currentUser?.role === 'admin',
  });

  const { data: allAgreements = [] } = useQuery({
    queryKey: ['allAgreements'],
    queryFn: () => base44.entities.DocumentAgreement.list(),
  });

  const { data: userVotes = [] } = useQuery({
    queryKey: ['userVotes', currentUser?.id],
    queryFn: () => base44.entities.Vote.filter({ userId: currentUser.id }),
    enabled: !!currentUser?.id,
  });

  const isAdmin = currentUser && groupMembers.some(
    m => m.groupId === groupId && m.userId === currentUser.id && m.role === 'admin'
  );

  // Check for unvoted suggestions per document
  const getUnvotedSuggestionsCount = (docId) => {
    if (!currentUser?.id) return 0;
    const docSuggestions = allSuggestions.filter(s => s.documentId === docId && s.status === 'pending' && s.type !== 'edit_suggestion');
    const unvoted = docSuggestions.filter(s => !userVotes.some(v => v.suggestionId === s.id));
    return unvoted.length;
  };

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

      // Send email + in-app notification to all admins
      await Promise.all([
        ...adminProfiles.map(admin =>
          base44.integrations.Core.SendEmail({
            to: admin.email,
            subject,
            body,
          })
        ),
        ...admins.map(admin =>
          base44.entities.Notification.create({
            userId: admin.userId,
            type: 'group_join_request',
            title: language === 'he' ? `בקשת הצטרפות לקבוצה` : `New join request`,
            message: language === 'he'
              ? `${userName} מבקש/ת להצטרף לקבוצה "${group?.name}"`
              : `${userName} wants to join the group "${group?.name}"`,
            relatedEntityId: group.id,
            relatedEntityType: 'document',
            actionUrl: createPageUrl("GroupView") + `?id=${group.id}`,
            read: false,
          })
        )
      ]);
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
            <div className="flex items-center gap-2">
              <PageHeader 
                title={translations['name'] || group.name}
                backUrl={createPageUrl("Groups")}
              />
              <button
                onClick={() => translateText('name', group.name)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 transition-colors shrink-0"
                title={translations['name'] ? (language === 'he' ? 'הצג מקור' : 'Show original') : (language === 'he' ? 'תרגם' : 'Translate')}
              >
                {translating['name'] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                <span>{translations['name'] ? (language === 'he' ? 'מקור' : 'Original') : (language === 'he' ? 'תרגם' : 'Translate')}</span>
              </button>
            </div>
            {group.description && (
              <div className="flex items-start gap-2">
                <p className="text-slate-600 flex-1">{translations['description'] || group.description}</p>
                <button
                  onClick={() => translateText('description', group.description)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 transition-colors shrink-0 mt-0.5"
                  title={translations['description'] ? (language === 'he' ? 'הצג מקור' : 'Show original') : (language === 'he' ? 'תרגם' : 'Translate')}
                >
                  {translating['description'] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                  <span>{translations['description'] ? (language === 'he' ? 'מקור' : 'Original') : (language === 'he' ? 'תרגם' : 'Translate')}</span>
                </button>
              </div>
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
                    {documents.map((doc) => {
                      const participantsCount = calculateContributorsFromData({
                        document: doc,
                        suggestions: allSuggestions.filter(s => s.documentId === doc.id),
                        allVotes,
                        allUsers: publicProfiles,
                        allComments,
                        sections: allSections.filter(s => s.documentId === doc.id),
                        documentAgreements: allAgreements.filter(a => a.documentId === doc.id)
                      });
                      
                      const unvotedCount = getUnvotedSuggestionsCount(doc.id);

                      return (
                        <Link
                          key={doc.id}
                          to={`${createPageUrl("DocumentView")}?id=${doc.id}`}
                          className={`block overflow-hidden border rounded-lg hover:bg-slate-50 transition-colors ${unvotedCount > 0 ? 'ring-2 ring-orange-400' : ''}`}
                        >
                          {unvotedCount > 0 && (
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1.5 text-xs font-medium flex items-center gap-2">
                              <Bell className="w-3 h-3 animate-pulse" />
                              <span>
                                {language === 'he' 
                                  ? `${unvotedCount} ${unvotedCount === 1 ? 'הצעה' : 'הצעות'} ממתינות להצבעתך`
                                  : language === 'ar'
                                  ? `${unvotedCount} اقتراح بانتظار تصويتك`
                                  : `${unvotedCount} awaiting vote`}
                              </span>
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-slate-900">{translations[`doc-title-${doc.id}`] || doc.title}</h3>
                                  <button
                                    onClick={(e) => { e.preventDefault(); translateText(`doc-title-${doc.id}`, doc.title); }}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors shrink-0"
                                  >
                                    {translating[`doc-title-${doc.id}`] ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Languages className="w-2.5 h-2.5" />}
                                  </button>
                                </div>
                                {doc.description && (
                                  <div className="flex items-start gap-2 mt-1">
                                    <p className="text-sm text-slate-500 line-clamp-2 flex-1" 
                                       dangerouslySetInnerHTML={{ __html: translations[`doc-desc-${doc.id}`] || doc.description }} 
                                    />
                                    <button
                                      onClick={(e) => { e.preventDefault(); const tmp = document.createElement('div'); tmp.innerHTML = doc.description; translateText(`doc-desc-${doc.id}`, tmp.textContent || tmp.innerText || doc.description); }}
                                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors shrink-0 mt-0.5"
                                    >
                                      {translating[`doc-desc-${doc.id}`] ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Languages className="w-2.5 h-2.5" />}
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-sm text-slate-600 shrink-0">
                                <Users className="w-4 h-4" />
                                <span>{participantsCount}</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {language === 'he' ? 'חברי הקבוצה' : 'Members'}
                  </CardTitle>
                  {(isAdmin || isMember) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowInviteMember(true)}
                    >
                      <Mail className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {language === 'he' ? 'הזמן' : 'Invite'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(() => {
                    // Get all section contributors from group documents
                    const sectionContributors = allSections
                      .filter(section => documents.some(doc => doc.id === section.documentId))
                      .map(section => section.lastEditedBy || section.created_by_id)
                      .filter(Boolean);
                    
                    // Get unique user IDs
                    const uniqueUserIds = [...new Set([
                      ...groupMembers.map(m => m.userId),
                      ...sectionContributors
                    ])];
                    
                    return uniqueUserIds.map((userId) => {
                      const profile = publicProfiles.find(p => p.userId === userId);
                      const member = groupMembers.find(m => m.userId === userId);
                      
                      return (
                        <div key={userId} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                          <Link to={`${createPageUrl("Profile")}?userId=${userId}`} className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {profile?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">{profile?.fullName || userId}</p>
                            </div>
                          </Link>
                          {member?.role === 'admin' && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              {language === 'he' ? 'מנהל' : 'Admin'}
                            </Badge>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <ManageMembersDialog
          groupId={groupId}
          isOpen={showManageMembers}
          onClose={() => setShowManageMembers(false)}
          onGroupDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            navigate(createPageUrl("Groups"));
          }}
        />

        <InviteMemberDialog
          groupId={groupId}
          groupName={group.name}
          isOpen={showInviteMember}
          onClose={() => setShowInviteMember(false)}
        />
      </div>
    </div>
  );
}