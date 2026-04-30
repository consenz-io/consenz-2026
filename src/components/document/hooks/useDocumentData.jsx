import React from "react";
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: 1000,
  });

  const { data: sections = [], isLoading: sectionsLoading, isError: sectionsError } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }, 'order').catch(() => []),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: 1000,
  });

  const { data: suggestions = [], isLoading: suggestionsLoading, isError: suggestionsError } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      const results = await base44.entities.Suggestion.filter({ documentId }, '-created_date');
      return results || [];
    },
    enabled: !!documentId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  // Stable key: only keyed by documentId — avoids a new query on every render
  // (suggestions/sections arrays change reference every render causing cache thrash)
  const { data: aggregatedData } = useQuery({
    queryKey: ['documentAggregatedData', documentId ?? '__none__'],
    queryFn: async () => {
      if (!documentId) return { votes: [], users: [], publicProfiles: [], args: [], comments: [] };
      // Re-read from cache at fetch time so we always have the latest IDs
      // without capturing stale closures
      const [allSuggestions, allSections] = await Promise.all([
        base44.entities.Suggestion.filter({ documentId }, '-created_date').catch(() => []),
        base44.entities.Section.filter({ documentId }, 'order').catch(() => []),
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
    staleTime: 2 * 60 * 1000,
  });

  // Seed individual caches from aggregatedData
  React.useEffect(() => {
    if (!aggregatedData || !documentId) return;
    const { comments = [], publicProfiles: profiles = [] } = aggregatedData;
    if (profiles.length > 0) {
      queryClient.setQueryData(['publicProfiles'], profiles);
    }
    queryClient.setQueryData(
      ['comments', 'document', documentId],
      comments.filter(c => c.rootEntityType === 'document' && c.rootEntityId === documentId)
    );
    sections.forEach(section => {
      queryClient.setQueryData(
        ['comments', 'section', section.id],
        comments.filter(c => c.rootEntityType === 'section' && c.rootEntityId === section.id)
      );
    });
    suggestions.forEach(suggestion => {
      queryClient.setQueryData(
        ['comments', 'suggestion', suggestion.id],
        comments.filter(c => c.rootEntityType === 'suggestion' && c.rootEntityId === suggestion.id)
      );
    });
  }, [aggregatedData, documentId, sections, suggestions, queryClient]);

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
    staleTime: 300000,
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

  // Wait for document AND both topics+sections before showing content
  // Previously (topicsLoading && sectionsLoading) would stop waiting as soon as
  // ONE of them finished — causing the page to render with the other still empty.
  const isInitialLoading = docLoading || topicsLoading || sectionsLoading;

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