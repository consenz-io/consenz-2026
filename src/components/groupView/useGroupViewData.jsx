import { useMemo, useEffect, useRef } from "react";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { calcGroupParticipants } from "@/lib/groupParticipants";

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
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const { data: groupMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => base44.entities.GroupMember.filter({ groupId }),
    enabled: !!groupId,
    staleTime: 10 * 60 * 1000,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['groupDocuments', groupId],
    queryFn: () => base44.entities.Document.filter({ groupId }, '-created_date'),
    enabled: !!groupId,
    staleTime: 10 * 60 * 1000,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  const docIds = useMemo(() => documents.map(d => d.id), [documents]);
  const docIdsSorted = useMemo(() => [...docIds].sort().join(','), [docIds]);

  // Fetch ALL suggestions once — pending subset derived via useMemo (no duplicate query)
  const { data: allDocSuggestions = [] } = useQuery({
    queryKey: ['groupAllSuggestions', groupId, docIdsSorted],
    queryFn: async () => {
      if (docIds.length === 0) return [];
      const perDoc = await Promise.all(
        docIds.map(id => base44.entities.Suggestion.filter({ documentId: id }, null, 200).catch(() => []))
      );
      return perDoc.flat();
    },
    enabled: docIds.length > 0 && documents.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Derived — no extra network call. Filter out expired suggestions.
  const groupSuggestions = useMemo(() => {
    const now = new Date();
    return allDocSuggestions.filter(s =>
      s.status === 'pending' &&
      (!s.timerEndsAt || new Date(s.timerEndsAt) > now)
    );
  }, [allDocSuggestions]);

  const allDocSuggestionIds = useMemo(() => allDocSuggestions.map(s => s.id), [allDocSuggestions]);
  const allDocSuggestionIdsSorted = useMemo(() => [...allDocSuggestionIds].sort().join(','), [allDocSuggestionIds]);

  // Admin-only heavy queries — fetch per-suggestion to avoid unsupported $in operator
  const { data: allDocVotes = [] } = useQuery({
    queryKey: ['groupAllVotes', groupId, allDocSuggestionIdsSorted],
    queryFn: async () => {
      if (allDocSuggestionIds.length === 0) return [];
      const results = await Promise.all(
        allDocSuggestionIds.map(id => base44.entities.Vote.filter({ suggestionId: id }, null, 200).catch(() => []))
      );
      return results.flat();
    },
    enabled: allDocSuggestionIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: allDocSections = [] } = useQuery({
    queryKey: ['groupAllSections', groupId, docIdsSorted],
    queryFn: async () => {
      if (docIds.length === 0) return [];
      const perDoc = await Promise.all(
        docIds.map(id => base44.entities.Section.filter({ documentId: id }, null, 200).catch(() => []))
      );
      return perDoc.flat();
    },
    enabled: docIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const allDocSectionIdsSorted = useMemo(
    () => [...allDocSections.map(s => s.id)].sort().join(','),
    [allDocSections]
  );

  const { data: allDocComments = [] } = useQuery({
    queryKey: ['groupAllComments', groupId, docIdsSorted, allDocSuggestionIdsSorted, allDocSectionIdsSorted],
    queryFn: async () => {
      if (docIds.length === 0) return [];
      // Fetch per entity type separately — $in not supported by SDK
      const [docComments, sugComments, secComments] = await Promise.all([
        Promise.all(docIds.map(id => base44.entities.Comment.filter({ rootEntityId: id, rootEntityType: 'document' }, null, 200).catch(() => []))),
        allDocSuggestions.length > 0
          ? Promise.all(allDocSuggestions.map(s => base44.entities.Comment.filter({ rootEntityId: s.id, rootEntityType: 'suggestion' }, null, 200).catch(() => [])))
          : Promise.resolve([]),
        allDocSections.length > 0
          ? Promise.all(allDocSections.map(s => base44.entities.Comment.filter({ rootEntityId: s.id, rootEntityType: 'section' }, null, 200).catch(() => [])))
          : Promise.resolve([]),
      ]);
      return [...docComments.flat(), ...sugComments.flat(), ...secComments.flat()];
    },
    enabled: docIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: allDocAgreements = [] } = useQuery({
    queryKey: ['groupAllAgreements', groupId, docIdsSorted],
    queryFn: async () => {
      if (docIds.length === 0) return [];
      const results = await Promise.all(
        docIds.map(id => base44.entities.DocumentAgreement.filter({ documentId: id }, null, 200).catch(() => []))
      );
      return results.flat();
    },
    enabled: docIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Auto-add suggestion creators as formal group members if not already members.
  // IMPORTANT: We track "manually removed" userIds so the auto-add never re-adds
  // someone that an admin explicitly removed. This set is stored outside the effect
  // so it survives re-renders, but is scoped to this hook instance (page mount).
  // A full cross-session solution would require a server-side "blocklist" — for now
  // this covers the common in-session case.
  const autoAddedRef = React.useRef(new Set());
  const manuallyRemovedRef = React.useRef(new Set());

  // Expose a way for removeMember actions (in ManageMembersDialog) to mark a userId
  // as manually removed so the auto-add effect skips it. We attach it to queryClient
  // meta so ManageMembersDialog can call it without prop-drilling.
  React.useEffect(() => {
    queryClient.setQueryData(['__groupRemovedMembers', groupId], manuallyRemovedRef);
  }, [groupId, queryClient]);

  React.useEffect(() => {
    if (!groupId || groupMembers.length === 0 || publicProfiles.length === 0 || allDocSuggestions.length === 0) return;

    const memberUserIds = new Set(groupMembers.map(m => m.userId));
    const emailToUserId = new Map();
    publicProfiles.forEach(p => { if (p.email && p.userId) emailToUserId.set(p.email, p.userId); });

    const toAdd = [];
    const seenEmails = new Set();
    allDocSuggestions.forEach(s => {
      if (s.created_by && !seenEmails.has(s.created_by)) {
        seenEmails.add(s.created_by);
        const uid = emailToUserId.get(s.created_by);
        // Skip if already a member, manually removed by admin, or already queued this session
        if (uid && !memberUserIds.has(uid) && !autoAddedRef.current.has(uid) && !manuallyRemovedRef.current.has(uid)) {
          autoAddedRef.current.add(uid);
          toAdd.push(uid);
        }
      }
    });

    if (toAdd.length === 0) return;

    (async () => {
      try {
        const membersToCreate = toAdd.map(userId => ({ groupId, userId, role: 'member' }));
        await base44.entities.GroupMember.bulkCreate(membersToCreate).catch(async () => {
          await Promise.all(
            membersToCreate.map(m => base44.entities.GroupMember.create(m).catch(err => {
              console.error('[AUTO-ADD] Failed to add member:', err);
              return null;
            }))
          );
        });
        queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      } catch (err) {
        console.error('[AUTO-ADD] Failed to auto-add members:', err);
      }
    })();
  }, [groupId, groupMembers, publicProfiles, allDocSuggestions, queryClient]);

  // All unique participant userIds — via unified calcGroupParticipants (single source of truth)
  const allParticipantUserIds = useMemo(() =>
    Array.from(calcGroupParticipants(groupId, groupMembers, documents, allDocSuggestions, allDocVotes, allDocComments, publicProfiles, allDocAgreements, allDocSections)),
    [groupId, groupMembers, documents, allDocSuggestions, allDocVotes, allDocComments, publicProfiles, allDocAgreements, allDocSections]
  );

  const { data: userVotes = [] } = useQuery({
    queryKey: ['userVotes', currentUser?.id],
    queryFn: () => base44.entities.Vote.filter({ userId: currentUser.id }, null, 500),
    enabled: !!currentUser?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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

  // Memoize votedIds set — rebuilt only when userVotes changes, not on every render
  const votedIds = useMemo(() => new Set(userVotes.map(v => v.suggestionId)), [userVotes]);

  const getUnvotedCount = useMemo(() => (docId) => {
    if (!currentUser?.id) return 0;
    return groupSuggestions.filter(s =>
      s.documentId === docId &&
      s.type !== 'edit_suggestion' &&
      s.created_by !== currentUser.email &&
      !votedIds.has(s.id)
    ).length;
  }, [currentUser, groupSuggestions, votedIds]);

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
    currentUser, group, groupMembers, allParticipantUserIds, documents, publicProfiles,
    allDocSuggestions, allDocComments,
    isAdmin, isMember, getUnvotedCount,
    isLoading: groupLoading || groupFetching || membersLoading || documentsLoading,
    joinGroupMutation, leaveGroupMutation, requestAccessMutation,
    queryClient,
    navigate,
  };
}