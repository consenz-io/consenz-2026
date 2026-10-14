import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useGroupsData() {
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Step 1: Fetch ALL groups — public/private are visible to everyone; hidden only to members.
  const { data: allGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['allGroups'],
    queryFn: () => base44.entities.Group.list('-created_date'),
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Step 2: Fetch this user's memberships (for hidden-group visibility + admin detection)
  const { data: myMemberships = [], isLoading: membersLoading } = useQuery({
    queryKey: ['myGroupMemberships', currentUser?.id],
    queryFn: () => base44.entities.GroupMember.filter({ userId: currentUser.id }),
    enabled: !!currentUser?.id,
    placeholderData: [],
    staleTime: 0, // Always revalidate — membership changes must reflect immediately
    gcTime: 5 * 60 * 1000,
  });

  // Visible groups: public + private visible to all; hidden only to members/admins/creator
  const visibleGroups = useMemo(() => {
    if (!currentUser) return [];
    return allGroups.filter((group) => {
      if (group.status === 'public' || group.status === 'private') return true;
      // hidden: require confirmed membership/admin/creator
      const isSystemAdmin = currentUser.role === 'admin';
      const isCreator = group.created_by === currentUser.email;
      const isMember = myMemberships.some(m => m.groupId === group.id);
      return isMember || isSystemAdmin || isCreator;
    });
  }, [allGroups, myMemberships, currentUser]);

  const visibleGroupIds = useMemo(() => visibleGroups.map(g => g.id).sort(), [visibleGroups]);
  const visibleGroupIdsKey = useMemo(() => visibleGroupIds.join(','), [visibleGroupIds]);

  // Step 3: Fetch documents in those groups (for doc count per group)
  const { data: documents = [] } = useQuery({
    queryKey: ['groupDocuments', visibleGroupIdsKey],
    queryFn: () => base44.entities.Document.filter({ groupId: { $in: visibleGroupIds } }),
    enabled: visibleGroupIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Step 4: Member count per group — single aggregate call instead of fetching all member records
  const { data: memberCountMap = {} } = useQuery({
    queryKey: ['groupMemberCounts', visibleGroupIdsKey],
    queryFn: async () => {
      const result = await base44.entities.GroupMember.aggregate({
        query: { groupId: { $in: visibleGroupIds } },
        groupBy: 'groupId'
      });
      const map = {};
      for (const row of result.rows || []) {
        map[row.groupId] = row.count;
      }
      return map;
    },
    enabled: visibleGroupIds.length > 0,
    placeholderData: {},
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Step 5: Participant counts — single backend function call instead of fetching
  // 12,000+ records (suggestions, votes, sections, sectionVotes, comments,
  // agreements, UserPublicProfile) into the browser.
  const { data: participantCountMap = {} } = useQuery({
    queryKey: ['groupParticipantCounts', visibleGroupIdsKey],
    queryFn: async () => {
      const res = await base44.functions.invoke('getGroupParticipantCounts', {
        groupIds: visibleGroupIds,
      });
      return res.data?.counts || {};
    },
    enabled: visibleGroupIds.length > 0,
    placeholderData: {},
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Pre-build O(1) count maps
  const docCountByGroup = useMemo(() => {
    const map = new Map();
    for (const d of documents) map.set(d.groupId, (map.get(d.groupId) ?? 0) + 1);
    return map;
  }, [documents]);

  const adminGroupIds = useMemo(() => {
    if (!currentUser?.id) return new Set();
    return new Set(
      myMemberships
        .filter(m => m.userId === currentUser.id && m.role === 'admin')
        .map(m => m.groupId)
    );
  }, [myMemberships, currentUser?.id]);

  const getDocCount = useCallback((groupId) => docCountByGroup.get(groupId) ?? 0, [docCountByGroup]);
  const getMemberCount = useCallback((groupId) => memberCountMap[groupId] ?? 0, [memberCountMap]);
  const getParticipantCount = useCallback((groupId) => participantCountMap[groupId] ?? 0, [participantCountMap]);
  const isGroupAdmin = useCallback((groupId) => adminGroupIds.has(groupId), [adminGroupIds]);

  // isLoading: show skeletons only while we're still resolving the user or the initial
  // groups list. We do NOT block on memberships — otherwise non-members (fresh users) would
  // stare at skeletons forever instead of seeing public/private groups immediately.
  const isLoading = userLoading || groupsLoading;

  return {
    currentUser,
    visibleGroups,
    isLoading,
    getDocCount,
    getMemberCount,
    getParticipantCount,
    isGroupAdmin,
  };
}