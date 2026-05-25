import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { calcGroupParticipants } from "@/lib/groupParticipants";

export function useGroupsData() {
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  // Step 1: Fetch only this user's memberships
  const { data: myMemberships = [], isLoading: membersLoading, isFetching: membersFetching } = useQuery({
    queryKey: ['myGroupMemberships', currentUser?.id],
    queryFn: () => base44.entities.GroupMember.filter({ userId: currentUser.id }),
    enabled: !!currentUser?.id,
    placeholderData: [],
    staleTime: 0, // Always revalidate — membership changes must reflect immediately
    gcTime: 5 * 60 * 1000,
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

  // Step 5: Fetch public profiles for email→userId mapping
  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    enabled: groupIds.length > 0,
    placeholderData: [],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // Step 6: Fetch all suggestions, votes, comments for group docs (participant counting)
  const { data: groupAllSuggestions = [] } = useQuery({
    queryKey: ['groupsPageAllSuggestions', docIds],
    queryFn: () => base44.entities.Suggestion.filter({ documentId: { $in: docIds } }, null, 2000),
    enabled: docIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const suggestionIds = useMemo(() => groupAllSuggestions.map(s => s.id).sort(), [groupAllSuggestions]);

  const { data: groupAllVotes = [] } = useQuery({
    queryKey: ['groupsPageAllVotes', suggestionIds],
    queryFn: () => base44.entities.Vote.filter({ suggestionId: { $in: suggestionIds } }, null, 2000),
    enabled: suggestionIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const { data: groupAllSections = [] } = useQuery({
    queryKey: ['groupsPageAllSections', docIds],
    queryFn: () => base44.entities.Section.filter({ documentId: { $in: docIds } }, null, 1000),
    enabled: docIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const { data: groupAllAgreements = [] } = useQuery({
    queryKey: ['groupsPageAllAgreements', docIds],
    queryFn: () => base44.entities.DocumentAgreement.filter({ documentId: { $in: docIds } }, null, 500),
    enabled: docIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const sectionIds = useMemo(() => groupAllSections.map(s => s.id).sort(), [groupAllSections]);

  const allRootEntityIds = useMemo(
    () => [...docIds, ...suggestionIds, ...sectionIds],
    [docIds, suggestionIds, sectionIds]
  );

  const { data: groupAllComments = [] } = useQuery({
    queryKey: ['groupsPageAllComments', allRootEntityIds],
    queryFn: () => base44.entities.Comment.filter({ rootEntityId: { $in: allRootEntityIds } }, null, 2000),
    enabled: allRootEntityIds.length > 0,
    placeholderData: [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const getParticipantCount = (groupId) =>
    calcGroupParticipants(groupId, groupMembers, documents, groupAllSuggestions, groupAllVotes, groupAllComments, publicProfiles, groupAllAgreements, groupAllSections).size;

  // Visible groups: apply privacy rules based on fresh membership data
  // - public: always visible
  // - private: only visible to members, admins, or creators
  // - hidden: only visible to members, admins, or creators
  const visibleGroups = useMemo(() => {
    if (!currentUser) return [];
    // Don't render anything until memberships have been confirmed (not just from placeholder)
    if (membersFetching && myMemberships.length === 0) return [];
    return groups.filter((group) => {
      const isSystemAdmin = currentUser.role === 'admin';
      const isCreator = group.created_by === currentUser.email;
      const isMember = myMemberships.some(m => m.groupId === group.id);
      const hasAccess = isMember || isSystemAdmin || isCreator;
      if (group.status === 'public') return true;
      // private and hidden: require confirmed membership/admin/creator
      return hasAccess;
    });
  }, [groups, myMemberships, currentUser, membersFetching]);

  const getDocCount = (groupId) => documents.filter(d => d.groupId === groupId).length;
  const getMemberCount = (groupId) => groupMembers.filter(m => m.groupId === groupId).length;
  const isGroupAdmin = (groupId) => currentUser
    ? myMemberships.some(m => m.groupId === groupId && m.userId === currentUser.id && m.role === 'admin')
    : false;

  // isLoading must stay true until we have a definitive answer about which groups the user belongs to.
  // The critical edge case: currentUser arrives from cache (userLoading=false) but the memberships
  // query hasn't fired yet (enabled just became true). We guard this by checking fetchStatus.
  const isLoadingFinal =
    userLoading ||
    !currentUser ||               // user not resolved yet
    membersLoading ||             // memberships still fetching
    membersFetching ||            // memberships fetching (incl. placeholderData state)
    (groupIds.length > 0 && groupsLoading); // groups themselves loading

  return {
    currentUser,
    visibleGroups,
    isLoading: isLoadingFinal,
    getDocCount,
    getMemberCount,
    getParticipantCount,
    isGroupAdmin,
  };
}