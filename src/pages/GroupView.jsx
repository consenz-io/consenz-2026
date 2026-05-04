import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Lock, Globe, FileText, Plus, Settings, UserPlus, AlertCircle, Mail } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import ManageMembersDialog from "@/components/group/ManageMembersDialog";
import InviteMemberDialog from "@/components/group/InviteMemberDialog";
import { useGroupViewData } from "@/components/groupView/useGroupViewData";
import GroupDocumentRow from "@/components/groupView/GroupDocumentRow";
import GroupMemberRow from "@/components/groupView/GroupMemberRow";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function GroupView() {
  const { isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('id');
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);

  const {
    currentUser, group, groupMembers, documents, publicProfiles,
    isAdmin, isMember, getUnvotedCount, isLoading,
    joinGroupMutation, leaveGroupMutation, requestAccessMutation,
    queryClient, navigate,
  } = useGroupViewData(groupId);

  const [orderedDocs, setOrderedDocs] = useState(null);

  // Sync orderedDocs when documents change (initial load)
  React.useEffect(() => {
    if (documents.length > 0) {
      setOrderedDocs(prev => {
        if (!prev) return documents;
        // Keep custom order but add any new docs
        const existingIds = new Set(prev.map(d => d.id));
        const newDocs = documents.filter(d => !existingIds.has(d.id));
        const updated = prev.map(d => documents.find(dd => dd.id === d.id) || d);
        return [...updated, ...newDocs];
      });
    }
  }, [documents]);

  const displayedDocs = orderedDocs || documents;

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(displayedDocs);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setOrderedDocs(items);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>{language === 'he' ? 'קבוצה לא נמצאה' : 'Group not found'}</AlertDescription></Alert>
        </div>
      </div>
    );
  }

  const isCreator = currentUser && group.created_by === currentUser.email;
  const isSystemAdmin = currentUser && currentUser.role === 'admin';

  if (group.status === 'hidden' && !(isMember || isCreator || isSystemAdmin)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Alert><Lock className="h-4 w-4" /><AlertDescription>{language === 'he' ? 'קבוצה חסויה - אינה זמינה' : 'Hidden group - not available'}</AlertDescription></Alert>
        </div>
      </div>
    );
  }

  if (group.status === 'private' && !isMember) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <Alert><Lock className="h-4 w-4" /><AlertDescription>{language === 'he' ? 'קבוצה פרטית - נדרשת חברות' : 'Private group - membership required'}</AlertDescription></Alert>
          {currentUser && (
            <Card className="bg-white">
              <CardHeader><CardTitle className="text-lg">{language === 'he' ? 'מעוניין להצטרף?' : 'Want to join?'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-600 text-sm">{language === 'he' ? 'שלח בקשה לאדמיני הקבוצה' : 'Send a request to the group admins'}</p>
                <Button onClick={() => requestAccessMutation.mutate()} disabled={requestAccessMutation.isPending || requestAccessMutation.isSuccess} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  <Mail className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {requestAccessMutation.isSuccess ? (language === 'he' ? 'הבקשה נשלחה' : 'Request sent') : (language === 'he' ? 'שלח בקשה להצטרפות' : 'Request to join')}
                </Button>
                {requestAccessMutation.isSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">{language === 'he' ? 'הבקשה נשלחה בהצלחה' : 'Request sent successfully'}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const statusBadgeCls = group.status === 'private' ? 'bg-amber-50 text-amber-700 border-amber-200' : group.status === 'hidden' ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-blue-50 text-blue-700 border-blue-200';
  const statusLabel = group.status === 'private' ? (language === 'he' ? 'פרטי' : 'Private') : group.status === 'hidden' ? (language === 'he' ? 'חסוי' : 'Hidden') : (language === 'he' ? 'ציבורי' : 'Public');
  const StatusIcon = group.status === 'public' ? Globe : Lock;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <PageHeader title={group.name} backUrl={createPageUrl("Groups")} />
            {group.description && (
              <p className="text-slate-600">{group.description}</p>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={statusBadgeCls}>
                <StatusIcon className="w-3 h-3 mr-1" />{statusLabel}
              </Badge>
              <Badge variant="outline"><Users className="w-3 h-3 mr-1" />{groupMembers.length} {language === 'he' ? 'חברים' : 'members'}</Badge>
              {isAdmin && <Badge className="bg-purple-100 text-purple-800 border-purple-200">{language === 'he' ? 'מנהל' : 'Admin'}</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => setShowManageMembers(true)}>
                <Settings className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{language === 'he' ? 'ניהול' : 'Manage'}
              </Button>
            )}
            {currentUser && !isMember && group.status === 'public' && (
              <Button onClick={() => joinGroupMutation.mutate()} disabled={joinGroupMutation.isPending} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <UserPlus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{language === 'he' ? 'הצטרף לקבוצה' : 'Join Group'}
              </Button>
            )}
            {isMember && !isAdmin && (
              <Button variant="outline" onClick={() => leaveGroupMutation.mutate()} disabled={leaveGroupMutation.isPending}>
                {language === 'he' ? 'עזוב קבוצה' : 'Leave Group'}
              </Button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />{language === 'he' ? 'מסמכי הקבוצה' : 'Group Documents'}
                  </CardTitle>
                  {isMember && (
                    <Link to={`${createPageUrl("CreateDocument")}?groupId=${groupId}`}>
                      <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <Plus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{language === 'he' ? 'מסמך חדש' : 'New Document'}
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {displayedDocs.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">{language === 'he' ? 'אין עדיין מסמכים בקבוצה זו' : 'No documents in this group yet'}</p>
                ) : (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="group-documents">
                      {(provided) => (
                        <div
                          className="space-y-3"
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                        >
                          {displayedDocs.map((doc, index) => (
                            <Draggable key={doc.id} draggableId={doc.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={snapshot.isDragging ? 'opacity-70 shadow-lg rounded-lg' : ''}
                                >
                                  <GroupDocumentRow
                                   doc={doc}
                                   unvotedCount={getUnvotedCount(doc.id)}
                                   participantCount={groupMembers.length}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />{language === 'he' ? 'חברי הקבוצה' : 'Members'}
                  </CardTitle>
                  {(isAdmin || isMember) && (
                    <Button size="sm" variant="outline" onClick={() => setShowInviteMember(true)}>
                      <Mail className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{language === 'he' ? 'הזמן' : 'Invite'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...new Set(groupMembers.map(m => m.userId))].map(userId => {
                    const profile = publicProfiles.find(p => p.userId === userId);
                    const member = groupMembers.find(m => m.userId === userId);
                    return <GroupMemberRow key={userId} userId={userId} profile={profile} role={member?.role} />;
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
          onGroupDeleted={() => { queryClient.invalidateQueries({ queryKey: ['groups'] }); navigate(createPageUrl("Groups")); }}
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