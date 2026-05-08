import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useGroupsData() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  // Step 1: Fetch only this user's memberships
  const { data: myMemberships = [], isLoading: membersLoading } = useQuery({
    queryKey: ['myGroupMemberships', currentUser?.id],
    queryFn: () => base44.entities.GroupMember.filter({ userId: currentUser.id }),
    enabled: !!currentUser?.id,
    placeholderData: [],
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

  const groupIds = useMemo(() => myMemberships.map(m => m.groupId).sort(), [myMemberships]);

  // Step 2: Fetch only the groups the user belongs to
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['myGroups', groupIds],
    queryFn: () => base44.entities.Group.filter({ id: { $in: groupIds } }, '-created_date'),
    enabled: groupIds.length > 0,
    placeholderData: [],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Step 3: Fetch member counts for those groups
  const { data: groupMembers = [] } = useQuery({
    queryKey: ['groupMembersForGroups', groupIds],
    queryFn: () => base44.entities.GroupMember.filter({ groupId: { $in: groupIds } }),
    enabled: groupIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Step 4: Fetch documents in those groups
  const { data: documents = [] } = useQuery({
    queryKey: ['groupDocuments', groupIds],
    queryFn: () => base44.entities.Document.filter({ groupId: { $in: groupIds } }),
    enabled: groupIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const docIds = useMemo(() => documents.map(d => d.id).sort(), [documents]);

  // Step 5: Fetch UserInteractions for all group documents to count unique participants
  const { data: userInteractions = [] } = useQuery({
    queryKey: ['groupUserInteractions', docIds],
    queryFn: () => base44.entities.UserInteraction.filter({ documentId: { $in: docIds } }),
    enabled: docIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Visible groups: hidden groups only visible to members/admins/creators
  const visibleGroups = useMemo(() => {
    if (!currentUser) return [];
    return groups.filter((group) => {
      if (group.status === 'public' || group.status === 'private') return true;
      // hidden group — user is a member (already fetched only their groups), admin, or creator
      const isAdmin = currentUser.role === 'admin';
      const isCreator = group.created_by === currentUser.email;
      const isMember = myMemberships.some(m => m.groupId === group.id);
      return isMember || isAdmin || isCreator;
    });
  }, [groups, myMemberships, currentUser]);

  const getDocCount = (groupId) => documents.filter(d => d.groupId === groupId).length;

  // Count unique participants across all docs in a group (via UserInteraction)
  const getParticipantCount = (groupId) => {
    const groupDocIds = new Set(documents.filter(d => d.groupId === groupId).map(d => d.id));
    const uniqueUsers = new Set(
      userInteractions.filter(ui => groupDocIds.has(ui.documentId)).map(ui => ui.userId)
    );
    return uniqueUsers.size;
  };

  const getMemberCount = (groupId) => groupMembers.filter(m => m.groupId === groupId).length;
  const isGroupAdmin = (groupId) => currentUser
    ? myMemberships.some(m => m.groupId === groupId && m.userId === currentUser.id && m.role === 'admin')
    : false;

  return {
    currentUser,
    visibleGroups,
    isLoading: membersLoading || (groupIds.length > 0 && groupsLoading),
    getDocCount,
    getMemberCount,
    getParticipantCount,
    isGroupAdmin,
  };
}