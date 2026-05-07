import React, { useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Aggregates all data-fetching queries for DocumentView.
 * Keeps the page component focused on UI logic only.
 */
export function useDocumentData(documentId) {
  const queryClient = useQueryClient();

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: async () => {
      const docs = await base44.entities.Document.filter({ id: documentId });
      return docs && docs.length > 0 ? docs[0] : null;
    },
    enabled: !!documentId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: 5 * 60 * 1000,
  });

  const { data: topics = [], isLoading: topicsLoading, isError: topicsError } = useQuery({
    queryKey: ['topics', documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId }, 'order').catch(() => []),
    enabled: !!documentId,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: 1000,
    // NOTE: no placeholderData — using it caused stale data from a previous document
    // to show when navigating between documents (same prev reference across queryKey changes)
  });

  const { data: sections = [], isLoading: sectionsLoading, isError: sectionsError } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }, 'order').catch(() => []),
    enabled: !!documentId,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: 1000,
    // NOTE: no placeholderData — same reason as topics above
  });

  const { data: suggestions = [], isLoading: suggestionsLoading, isError: suggestionsError } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      const results = await base44.entities.Suggestion.filter({ documentId }, '-created_date');
      return results || [];
    },
    enabled: !!documentId,
    staleTime: 0,           // Always fetch fresh — suggestions change frequently
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,   // Re-fetch when navigating back to this page
    retry: 2,
  });

  // Stable key: only keyed by documentId — avoids a new query on every render
  // Note: suggestions/sections are re-fetched here to get fresh IDs at query time
  // without stale closure issues. The individual queries above remain separate
  // so isInitialLoading works correctly.
  const { data: aggregatedData } = useQuery({
    queryKey: ['documentAggregatedData', documentId],
    queryFn: async () => {
      // Read IDs from the already-populated cache first to avoid double-fetch
      const cachedSuggestions = queryClient.getQueryData(['suggestions', documentId]);
      const cachedSections = queryClient.getQueryData(['sections', documentId]);

      const [allSuggestions, allSections] = await Promise.all([
        // Always fetch fresh suggestions — never rely on potentially stale cache
        // (stale cache is the root cause of missing suggestions after navigation)
        base44.entities.Suggestion.filter({ documentId }, '-created_date').catch(() => cachedSuggestions || []),
        cachedSections
          ? Promise.resolve(cachedSections)
          : base44.entities.Section.filter({ documentId }, 'order').catch(() => []),
      ]);
      const suggestionIds = allSuggestions.map(s => s.id);
      const sectionIds = allSections.map(s => s.id);

      const [votes, publicProfiles, args, docComments, sectionComments, suggestionComments] = await Promise.all([
        suggestionIds.length > 0
          ? base44.entities.Vote.filter({ suggestionId: { $in: suggestionIds } }).catch(() => [])
          : Promise.resolve([]),
        base44.entities.UserPublicProfile.list().catch(() => []),
        suggestionIds.length > 0
          ? base44.entities.Argument.filter({ suggestionId: { $in: suggestionIds } }).catch(() => [])
          : Promise.resolve([]),
        base44.entities.Comment.filter({ rootEntityType: 'document', rootEntityId: documentId }).catch(() => []),
        sectionIds.length > 0
          ? base44.entities.Comment.filter({ rootEntityType: 'section', rootEntityId: { $in: sectionIds } }).catch(() => [])
          : Promise.resolve([]),
        suggestionIds.length > 0
          ? base44.entities.Comment.filter({ rootEntityType: 'suggestion', rootEntityId: { $in: suggestionIds } }).catch(() => [])
          : Promise.resolve([]),
      ]);
      const comments = [...docComments, ...sectionComments, ...suggestionComments];
      return { votes, users: publicProfiles, publicProfiles, args, comments };
    },
    enabled: !!documentId,
    staleTime: 0,           // Always re-fetch — votes/comments change frequently
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });

  // Seed individual caches from aggregatedData — only re-runs when aggregatedData changes,
  // not on every sections/suggestions reference change (avoids cascade re-runs)
  const aggregatedDataRef = React.useRef(null);
  React.useEffect(() => {
    if (!aggregatedData || !documentId) return;
    // Skip if same object reference (no change)
    if (aggregatedDataRef.current === aggregatedData) return;
    aggregatedDataRef.current = aggregatedData;

    const { comments = [], publicProfiles: profiles = [] } = aggregatedData;
    if (profiles.length > 0) {
      queryClient.setQueryData(['publicProfiles'], profiles);
    }

    // Group comments by type+id in a single pass
    const commentsByKey = new Map();
    for (const c of comments) {
      const key = `${c.rootEntityType}:${c.rootEntityId}`;
      if (!commentsByKey.has(key)) commentsByKey.set(key, []);
      commentsByKey.get(key).push(c);
    }

    queryClient.setQueryData(
      ['comments', 'document', documentId],
      commentsByKey.get(`document:${documentId}`) || []
    );

    // Seed section and suggestion comment caches from the already-grouped map
    commentsByKey.forEach((arr, key) => {
      const [type, id] = key.split(':');
      if (type === 'section') {
        queryClient.setQueryData(['comments', 'section', id], arr);
      } else if (type === 'suggestion') {
        queryClient.setQueryData(['comments', 'suggestion', id], arr);
      }
    });
  }, [aggregatedData, documentId, queryClient]);

  const { data: documentMetadata } = useQuery({
    queryKey: ['documentMetadata', documentId],
    queryFn: async () => {
      const [agreements, versions] = await Promise.all([
        base44.entities.DocumentAgreement.filter({ documentId }),
        base44.entities.DocumentVersion.filter({ documentId }),
      ]);
      return { agreements, versions };
    },
    enabled: !!documentId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 0,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ['isAdmin', documentId, user?.id],
    queryFn: async () => {
      if (!user?.id || !documentId) return false;
      const admins = await base44.entities.DocumentAdmin.filter({ documentId, userId: user.id });
      return admins.length > 0;
    },
    enabled: !!user?.id && !!documentId,
  });

  const { data: groupData } = useQuery({
    queryKey: ['documentGroup', document?.groupId],
    queryFn: async () => {
      if (!document?.groupId) return null;
      const [groups, members] = await Promise.all([
        base44.entities.Group.filter({ id: document.groupId }),
        base44.entities.GroupMember.filter({ groupId: document.groupId }),
      ]);
      return { group: groups[0] || null, members };
    },
    enabled: !!document?.groupId,
    staleTime: 2 * 60 * 1000,
  });

  const allVotes = aggregatedData?.votes || [];
  const publicProfiles = aggregatedData?.publicProfiles || [];
  const allComments = aggregatedData?.comments || [];
  const documentAgreements = React.useMemo(() => documentMetadata?.agreements || [], [documentMetadata?.agreements]);
  const documentVersions = React.useMemo(() => documentMetadata?.versions || [], [documentMetadata?.versions]);

  // Wait for document AND both topics+sections AND aggregatedData before showing content
  // aggregatedData is critical because it re-fetches suggestions fresh (avoiding stale cache)
  // Without waiting for it, suggestions appear empty even though they're loading
  const isInitialLoading = docLoading || topicsLoading || sectionsLoading || !aggregatedData;

  return {
    document, topics, sections, suggestions,
    aggregatedData, allVotes, publicProfiles, allComments,
    documentAgreements, documentVersions,
    documentMetadata,
    user, isAdmin, groupData,
    isInitialLoading,
    suggestionsLoading, sectionsLoading,
  };
}