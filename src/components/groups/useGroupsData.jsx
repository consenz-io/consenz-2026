import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { calcAllGroupParticipants } from "@/lib/groupParticipants";

export function useGroupsData() {
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Step 1: Fetch ALL groups — public/private are visible to everyone; hidden only to members.
  // (Previously this fetched only member groups, which hid every group from non-members.)
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

  // Fetch data for ALL visible groups (not just member groups) so doc/member counts are correct
  const visibleGroupIds = useMemo(() => visibleGroups.map(g => g.id).sort(), [visibleGroups]);
  const visibleGroupIdsKey = useMemo(() => visibleGroupIds.join(','), [visibleGroupIds]);

  // Step 3: Fetch documents in those groups
  const { data: documents = [] } = useQuery({
    queryKey: ['groupDocuments', visibleGroupIdsKey],
    queryFn: () => base44.entities.Document.filter({ groupId: { $in: visibleGroupIds } }),
    enabled: visibleGroupIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Step 4: Fetch member counts for those groups
  const { data: groupMembers = [] } = useQuery({
    queryKey: ['groupMembersForGroups', visibleGroupIdsKey],
    queryFn: () => base44.entities.GroupMember.filter({ groupId: { $in: visibleGroupIds } }),
    enabled: visibleGroupIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const docIds = useMemo(() => documents.map(d => d.id).sort(), [documents]);
  const docIdsKey = useMemo(() => docIds.join(','), [docIds]);

  // Step 5: Fetch public profiles for email→userId mapping
  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    enabled: visibleGroupIds.length > 0,
    placeholderData: [],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // Step 6: Fetch all suggestions, votes, comments for group docs (participant counting)
  const { data: groupAllSuggestions = [] } = useQuery({
    queryKey: ['groupsPageAllSuggestions', docIdsKey],
    queryFn: () => base44.entities.Suggestion.filter({ documentId: { $in: docIds } }, null, 2000),
    enabled: docIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const suggestionIds = useMemo(() => groupAllSuggestions.map(s => s.id).sort(), [groupAllSuggestions]);
  const suggestionIdsKey = useMemo(() => suggestionIds.join(','), [suggestionIds]);

  const { data: groupAllVotes = [] } = useQuery({
    queryKey: ['groupsPageAllVotes', suggestionIdsKey],
    queryFn: () => base44.entities.Vote.filter({ suggestionId: { $in: suggestionIds } }, null, 2000),
    enabled: suggestionIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const { data: groupAllSections = [] } = useQuery({
    queryKey: ['groupsPageAllSections', docIdsKey],
    queryFn: () => base44.entities.Section.filter({ documentId: { $in: docIds } }, null, 1000),
    enabled: docIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const { data: groupAllAgreements = [] } = useQuery({
    queryKey: ['groupsPageAllAgreements', docIdsKey],
    queryFn: () => base44.entities.DocumentAgreement.filter({ documentId: { $in: docIds } }, null, 500),
    enabled: docIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const sectionIds = useMemo(() => groupAllSections.map(s => s.id).sort(), [groupAllSections]);
  const sectionIdsKey = useMemo(() => sectionIds.join(','), [sectionIds]);

  const allRootEntityIdsKey = useMemo(
    () => [docIdsKey, suggestionIdsKey, sectionIdsKey].join('|'),
    [docIdsKey, suggestionIdsKey, sectionIdsKey]
  );

  const allRootEntityIds = useMemo(
    () => [...docIds, ...suggestionIds, ...sectionIds],
    [docIds, suggestionIds, sectionIds]
  );

  const { data: groupAllComments = [] } = useQuery({
    queryKey: ['groupsPageAllComments', allRootEntityIdsKey],
    queryFn: () => base44.entities.Comment.filter({ rootEntityId: { $in: allRootEntityIds } }, null, 2000),
    enabled: allRootEntityIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Pre-compute ALL participant counts in a single O(N) pass — avoids O(groups × N) per render
  const allParticipantCounts = useMemo(
    () => calcAllGroupParticipants(visibleGroups, groupMembers, documents, groupAllSuggestions, groupAllVotes, groupAllComments, publicProfiles, groupAllAgreements, groupAllSections),
    [visibleGroups, groupMembers, documents, groupAllSuggestions, groupAllVotes, groupAllComments, publicProfiles, groupAllAgreements, groupAllSections]
  );
  const getParticipantCount = useCallback(
    (groupId) => allParticipantCounts.get(groupId) ?? 0,
    [allParticipantCounts]
  );

  // Pre-build O(1) count maps — avoids O(n) filter per group on every render
  const docCountByGroup = useMemo(() => {
    const map = new Map();
    for (const d of documents) map.set(d.groupId, (map.get(d.groupId) ?? 0) + 1);
    return map;
  }, [documents]);

  const memberCountByGroup = useMemo(() => {
    const map = new Map();
    for (const m of groupMembers) map.set(m.groupId, (map.get(m.groupId) ?? 0) + 1);
    return map;
  }, [groupMembers]);

  const adminGroupIds = useMemo(() => {
    if (!currentUser?.id) return new Set();
    return new Set(
      myMemberships
        .filter(m => m.userId === currentUser.id && m.role === 'admin')
        .map(m => m.groupId)
    );
  }, [myMemberships, currentUser?.id]);

  const getDocCount = useCallback((groupId) => docCountByGroup.get(groupId) ?? 0, [docCountByGroup]);
  const getMemberCount = useCallback((groupId) => memberCountByGroup.get(groupId) ?? 0, [memberCountByGroup]);
  const isGroupAdmin = useCallback((groupId) => adminGroupIds.has(groupId), [adminGroupIds]);

  // isLoading: show skeletons only while we're still resolving the user or the initial
  // groups list. We do NOT block on memberships — otherwise non-members (fresh users) would
  // stare at skeletons forever instead of seeing public/private groups immediately.
  // Hidden groups will simply appear once memberships finish loading.
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