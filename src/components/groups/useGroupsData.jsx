import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useGroupsData() {
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list('-created_date'),
    staleTime: 3 * 60 * 1000,
  });

  const { data: groupMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['groupMembers'],
    queryFn: () => base44.entities.GroupMember.list(),
    staleTime: 3 * 60 * 1000,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list(),
    staleTime: 3 * 60 * 1000,
  });

  const visibleGroups = useMemo(() => {
    // Wait until members are loaded before filtering hidden groups
    if (membersLoading) return [];
    return groups.filter((group) => {
      if (group.status === 'public' || group.status === 'private') return true;
      if (!currentUser) return false;
      const isMember = groupMembers.some(m => m.groupId === group.id && m.userId === currentUser.id);
      const isAdmin = currentUser.role === 'admin';
      const isCreator = group.created_by === currentUser.email;
      return isMember || isAdmin || isCreator;
    });
  }, [groups, groupMembers, membersLoading, currentUser]);

  const getDocCount = (groupId) => documents.filter(d => d.groupId === groupId).length;
  const getMemberCount = (groupId) => groupMembers.filter(m => m.groupId === groupId).length;
  const isGroupAdmin = (groupId) => currentUser
    ? groupMembers.some(m => m.groupId === groupId && m.userId === currentUser.id && m.role === 'admin')
    : false;

  return {
    currentUser,
    visibleGroups,
    isLoading: userLoading || groupsLoading || membersLoading,
    getDocCount,
    getMemberCount,
    isGroupAdmin,
  };
}