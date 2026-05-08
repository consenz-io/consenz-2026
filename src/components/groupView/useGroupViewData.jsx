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

  // Sort docIds for a stable cache key regardless of order changes
  const docIdsSorted = useMemo(() => [...docIds].sort().join(','), [docIds]);

  // Fetch pending suggestions — parallel per-doc to avoid sequential bottleneck
  const { data: groupSuggestions = [] } = useQuery({
    queryKey: ['groupSuggestions', groupId, docIdsSorted],
    queryFn: async () => {
      if (docIds.length === 0) return [];
      const perDoc = await Promise.all(
        docIds.map(id => base44.entities.Suggestion.filter({ documentId: id, status: 'pending' }, null, 50).catch(() => []))
      );
      return perDoc.flat();
    },
    enabled: docIds.length > 0 && documents.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch all suggestions (not just pending) — parallel
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

  // Fetch all votes on group doc suggestions
  const allDocSuggestionIds = useMemo(() => allDocSuggestions.map(s => s.id), [allDocSuggestions]);
  const allDocSuggestionIdsSorted = useMemo(() => [...allDocSuggestionIds].sort().join(','), [allDocSuggestionIds]);

  const { data: allDocVotes = [] } = useQuery({
    queryKey: ['groupAllVotes', groupId, allDocSuggestionIdsSorted],
    queryFn: async () => {
      if (allDocSuggestionIds.length === 0) return [];
      return base44.entities.Vote.filter({ suggestionId: { $in: allDocSuggestionIds } }, null, 1000).catch(() => []);
    },
    enabled: allDocSuggestionIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch all comments on group docs (sections + suggestions + document-level)
  const { data: allDocComments = [] } = useQuery({
    queryKey: ['groupAllComments', groupId, docIdsSorted],
    queryFn: async () => {
      if (docIds.length === 0) return [];
      return base44.entities.Comment.filter({ rootEntityId: { $in: docIds } }, null, 500).catch(() => []);
    },
    enabled: docIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch DocumentAgreement signers for group docs
  const { data: allDocAgreements = [] } = useQuery({
    queryKey: ['groupAllAgreements', groupId, docIdsSorted],
    queryFn: async () => {
      if (docIds.length === 0) return [];
      return base44.entities.DocumentAgreement.filter({ documentId: { $in: docIds } }, null, 500).catch(() => []);
    },
    enabled: docIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Auto-add suggestion creators as formal group members if not already members
  // Use a module-level map (outside component) to survive remounts without creating duplicates
  const autoAddRunKey = `${groupId}`;
  const autoAddedRef = React.useRef(new Set());
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
        // Skip if already a member OR already queued in this session for this group
        if (uid && !memberUserIds.has(uid) && !autoAddedRef.current.has(uid)) {
          autoAddedRef.current.add(uid);
          toAdd.push(uid);
        }
      }
    });

    if (toAdd.length === 0) return;

    // Use bulkCreate if available, otherwise allSettled with error handling
    (async () => {
      try {
        const membersToCreate = toAdd.map(userId => ({ groupId, userId, role: 'member' }));
        // Batch create for better performance
        await base44.entities.GroupMember.bulkCreate(membersToCreate).catch(async () => {
          // Fallback: Create one by one if bulk fails
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

  // All unique participant userIds — using unified calcGroupParticipants
  const allParticipantUserIds = useMemo(() => {
    const emailToUserId = new Map();
    publicProfiles.forEach(p => { if (p.email && p.userId) emailToUserId.set(p.email, p.userId); });

    const ids = new Set(groupMembers.filter(m => m.groupId === groupId).map(m => m.userId));

    const groupDocIds = new Set(documents.filter(d => d.groupId === groupId).map(d => d.id));
    const groupSuggestionIds = new Set();

    allDocSuggestions.forEach(s => {
      if (groupDocIds.has(s.documentId)) {
        groupSuggestionIds.add(s.id);
        if (s.created_by) { const uid = emailToUserId.get(s.created_by); if (uid) ids.add(uid); }
      }
    });
    allDocVotes.forEach(v => {
      if (groupSuggestionIds.has(v.suggestionId) && v.userId) ids.add(v.userId);
    });
    allDocComments.forEach(c => {
      if (!c.created_by) return;
      const inGroup = (c.rootEntityType === 'document' && groupDocIds.has(c.rootEntityId)) ||
                      (c.rootEntityType === 'suggestion' && groupSuggestionIds.has(c.rootEntityId));
      if (inGroup) { const uid = emailToUserId.get(c.created_by); if (uid) ids.add(uid); }
    });
    allDocAgreements.forEach(a => {
      if (groupDocIds.has(a.documentId) && a.userId) ids.add(a.userId);
    });

    return [...ids];
  }, [groupId, groupMembers, documents, publicProfiles, allDocSuggestions, allDocVotes, allDocComments, allDocAgreements]);

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
    currentUser, group, groupMembers, allParticipantUserIds, documents, publicProfiles,
    isAdmin, isMember, getUnvotedCount,
    isLoading: groupLoading || groupFetching || membersLoading || documentsLoading,
    joinGroupMutation, leaveGroupMutation, requestAccessMutation,
    queryClient,
    navigate,
  };
}