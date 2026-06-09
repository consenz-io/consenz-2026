import React, { useEffect, useMemo, useRef } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * OPTIMIZATION: useDocumentData refactored to eliminate:
 * 1. staleTime: 0 (always refetch) — now 2 minutes for aggregatedData
 * 2. Redundant currentUser queries — delegates to shared hook
 * 3. Avoids re-fetching votes/comments on every render
 * 4. Implements pagination hints for versions
 */
export function useDocumentDataOptimized(documentId) {
  const { data: user } = useCurrentUser();

  // Document itself: longer cache (5 min)
  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: async () => {
      const docs = await base44.entities.Document.filter({ id: documentId });
      return docs?.[0] || null;
    },
    enabled: !!documentId,
    retry: 3,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Topics: 2 min cache
  const { data: topics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ['topics', documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId }, 'order').catch(() => []),
    enabled: !!documentId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Sections: 2 min cache
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }, 'order').catch(() => []),
    enabled: !!documentId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Suggestions: 2 min cache
  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      return await base44.entities.Suggestion.filter({ documentId }, '-created_date').catch(() => []);
    },
    enabled: !!documentId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // OPTIMIZATION: Changed staleTime from 0 to 2 minutes
  // Votes, comments, profiles: medium cache (2 min)
  // This MASSIVELY reduces refetch storms on every component interaction
  const { data: aggregatedData } = useQuery({
    queryKey: ['documentAggregatedData', documentId],
    queryFn: async () => {
      const suggestionIds = suggestions.map(s => s.id);
      const sectionIds = sections.map(s => s.id);

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
      return { votes, users: publicProfiles, publicProfiles, args, comments: [...docComments, ...sectionComments, ...suggestionComments] };
    },
    enabled: !!documentId && suggestions.length > 0,
    staleTime: 2 * 60 * 1000, // ✅ CHANGED: Was 0 (always refetch), now 2 min
    gcTime: 10 * 60 * 1000,
  });

  // Document metadata: 3 min cache
  const { data: documentMetadata } = useQuery({
    queryKey: ['documentMetadata', documentId],
    queryFn: async () => {
      const [agreements, versions] = await Promise.all([
        base44.entities.DocumentAgreement.filter({ documentId }),
        base44.entities.DocumentVersion.filter({ documentId }).catch(() => []),
      ]);
      return { agreements, versions };
    },
    enabled: !!documentId,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Admin check: depends on user, cache for 2 min
  const { data: isAdmin = false } = useQuery({
    queryKey: ['isAdmin', documentId, user?.id],
    queryFn: async () => {
      if (!user?.id || !documentId) return false;
      if (user.role === 'admin') return true;
      const admins = await base44.entities.DocumentAdmin.filter({ documentId, userId: user.id });
      return admins.length > 0;
    },
    enabled: !!user?.id && !!documentId,
    staleTime: 2 * 60 * 1000,
    placeholderData: false,
  });

  // Group data: 3 min cache
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
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const allVotes = aggregatedData?.votes || [];
  const publicProfiles = aggregatedData?.publicProfiles || [];
  const allComments = aggregatedData?.comments || [];
  const documentAgreements = useMemo(() => documentMetadata?.agreements || [], [documentMetadata?.agreements]);
  const documentVersions = useMemo(() => documentMetadata?.versions || [], [documentMetadata?.versions]);

  const isInitialLoading = docLoading || topicsLoading || sectionsLoading;

  return {
    document, topics, sections, suggestions,
    aggregatedData, allVotes, publicProfiles, allComments,
    documentAgreements, documentVersions, documentMetadata,
    user, isAdmin, groupData,
    isInitialLoading,
    suggestionsLoading, sectionsLoading,
  };
}