import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";

export function useGroupViewData(groupId) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: group, isLoading: groupLoading, isFetching: groupFetching } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => base44.entities.Group.filter({ id: groupId }).then(g => g[0] || null),
    enabled: !!groupId,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  const { data: groupMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => base44.entities.GroupMember.filter({ groupId }),
    enabled: !!groupId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['groupDocuments', groupId],
    queryFn: () => base44.entities.Document.filter({ groupId }, '-created_date'),
    enabled: !!groupId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    staleTime: 5 * 60 * 1000,
  });

  const docIds = documents.map(d => d.id);

  const { data: groupSuggestions = [] } = useQuery({
    queryKey: ['groupSuggestions', groupId, docIds.join(',')],
    queryFn: () => Promise.all(
      docIds.map(id => base44.entities.Suggestion.filter({ documentId: id, status: 'pending' }, null, 50))
    ).then(results => results.flat()),
    enabled: docIds.length > 0,
    staleTime: 3 * 60 * 1000,
  });

  const { data: userVotes = [] } = useQuery({
    queryKey: ['userVotes', currentUser?.id],
    queryFn: () => base44.entities.Vote.filter({ userId: currentUser.id }, null, 500),
    enabled: !!currentUser?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Derived membership flags
  const isAdmin = useMemo(() =>
    currentUser ? groupMembers.some(m => m.groupId === groupId && m.userId === currentUser.id && m.role === 'admin') : false,
    [currentUser, groupMembers, groupId]
  );

  const isMember = useMemo(() =>
    currentUser ? groupMembers.some(m => m.groupId === groupId && m.userId === currentUser.id) : false,
    [currentUser, groupMembers, groupId]
  );

  const getUnvotedCount = (docId) => {
    if (!currentUser?.id) return 0;
    const votedIds = new Set(userVotes.map(v => v.suggestionId));
    return groupSuggestions.filter(s =>
      s.documentId === docId &&
      s.type !== 'edit_suggestion' &&
      s.created_by !== currentUser.email &&
      !votedIds.has(s.id)
    ).length;
  };

  // Mutations
  const joinGroupMutation = useMutation({
    mutationFn: () => base44.entities.GroupMember.create({ groupId: group.id, userId: currentUser.id, role: 'member' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] }),
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      const membership = groupMembers.find(m => m.userId === currentUser.id && m.groupId === groupId);
      if (membership) await base44.entities.GroupMember.delete(membership.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      navigate(createPageUrl("Groups"));
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: async () => {
      const admins = groupMembers.filter(m => m.role === 'admin');
      const adminProfiles = admins.map(admin => publicProfiles.find(p => p.userId === admin.userId)).filter(Boolean);
      if (!adminProfiles.length) return;

      const userName = currentUser?.full_name || currentUser?.email || 'משתמש';
      await base44.entities.GroupJoinRequest.create({
        groupId: group.id, userId: currentUser.id,
        userEmail: currentUser.email, userName, status: 'pending'
      });

      const manageUrl = `${window.location.origin}${createPageUrl("GroupView")}?id=${group.id}`;
      const subject = language === 'he' ? `בקשת הצטרפות לקבוצה: ${group?.name}` : `Request to join group: ${group?.name}`;
      const body = language === 'he'
        ? `שלום,\n\n${userName} מבקש/ת להצטרף לקבוצה "${group?.name}".\n\nאימייל המשתמש: ${currentUser.email}\n\nכדי לאשר או לדחות: ${manageUrl}\n\nתודה!`
        : `Hello,\n\n${userName} would like to join "${group?.name}".\n\nUser email: ${currentUser.email}\n\nManage: ${manageUrl}\n\nThank you!`;

      await Promise.all([
        ...adminProfiles.map(admin => base44.integrations.Core.SendEmail({ to: admin.email, subject, body })),
        ...admins.map(admin => base44.entities.Notification.create({
          userId: admin.userId,
          type: 'group_join_request',
          title: language === 'he' ? 'בקשת הצטרפות לקבוצה' : 'New join request',
          message: language === 'he' ? `${userName} מבקש/ת להצטרף לקבוצה "${group?.name}"` : `${userName} wants to join "${group?.name}"`,
          relatedEntityId: group.id, relatedEntityType: 'document',
          actionUrl: createPageUrl("GroupView") + `?id=${group.id}`, read: false,
        }))
      ]);
    },
  });

  return {
    currentUser, group, groupMembers, documents, publicProfiles,
    isAdmin, isMember, getUnvotedCount,
    isLoading: groupLoading || groupFetching || membersLoading || documentsLoading,
    joinGroupMutation, leaveGroupMutation, requestAccessMutation,
    queryClient,
    navigate,
  };
}