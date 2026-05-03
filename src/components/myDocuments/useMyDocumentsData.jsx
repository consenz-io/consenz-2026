import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useMyDocumentsData() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: userInteractions = [], isLoading: interactionsLoading } = useQuery({
    queryKey: ['userInteractions', user?.id],
    queryFn: () => base44.entities.UserInteraction.filter({ userId: user.id }),
    enabled: !!user?.id,
  });

  const { data: allDocuments = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['allDocuments'],
    queryFn: () => base44.entities.Document.list('-created_date'),
    enabled: !!user?.id,
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ['mySuggestions', user?.id],
    queryFn: () => base44.entities.Suggestion.filter({ created_by: user.email }),
    enabled: !!user?.email,
  });

  // Note: 'myVotes' and 'allVotes' below both fetch the same data (user's votes).
  // We use one query and share the result to avoid a duplicate network call.
  const { data: votes = [] } = useQuery({
    queryKey: ['allVotes', user?.id],
    queryFn: () => base44.entities.Vote.filter({ userId: user.id }),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const myDocumentIds = useMemo(() => {
    const suggestedDocIds = suggestions.map(s => s.documentId);
    const interactedDocIds = userInteractions.map(ui => ui.documentId);
    return [...new Set([...interactedDocIds, ...suggestedDocIds])];
  }, [suggestions, userInteractions]);

  const { data: allSuggestions = [] } = useQuery({
    queryKey: ['allSuggestions', myDocumentIds],
    queryFn: () => myDocumentIds.length > 0
      ? base44.entities.Suggestion.filter({ documentId: { $in: myDocumentIds } })
      : Promise.resolve([]),
    enabled: !!user?.id && myDocumentIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // votes and allVotes are the same data — use the single query above

  const { data: allUsers = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allSections = [] } = useQuery({
    queryKey: ['allSections', myDocumentIds],
    queryFn: () => myDocumentIds.length > 0
      ? base44.entities.Section.filter({ documentId: { $in: myDocumentIds } })
      : Promise.resolve([]),
    enabled: !!user?.id && myDocumentIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Compute stable IDs arrays for the comments query key so it re-runs when dependencies resolve
  const allSuggestionIds = useMemo(() => allSuggestions.map(s => s.id), [allSuggestions]);
  const allSectionIds = useMemo(() => allSections.map(s => s.id), [allSections]);

  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments', myDocumentIds, allSuggestionIds, allSectionIds],
    queryFn: async () => {
      if (myDocumentIds.length === 0) return [];
      if (allSuggestionIds.length === 0 && allSectionIds.length === 0) return [];
      return base44.entities.Comment.filter({
        rootEntityId: { $in: [...allSuggestionIds, ...allSectionIds, ...myDocumentIds] }
      });
    },
    enabled: !!user?.id && myDocumentIds.length > 0 && (allSuggestionIds.length > 0 || allSectionIds.length > 0),
    staleTime: 2 * 60 * 1000,
  });

  // O(1) set of suggestion IDs the user has already voted on
  const votedSuggestionIds = useMemo(() => new Set(votes.map(v => v.suggestionId)), [votes]);

  // Derive the full set of my documents (including voted ones)
  const myDocuments = useMemo(() => {
    const votedDocIds = allSuggestions
      .filter(s => votedSuggestionIds.has(s.id))
      .map(s => s.documentId);
    const allMyIds = new Set([...myDocumentIds, ...votedDocIds]);
    return allDocuments.filter(doc => allMyIds.has(doc.id));
  }, [allDocuments, myDocumentIds, allSuggestions, votedSuggestionIds]);

  // Pre-group pending suggestions by documentId for O(1) unvoted count lookup
  const pendingSuggestionsByDocId = useMemo(() => {
    const map = new Map();
    for (const s of allSuggestions) {
      if (s.status === 'pending' && s.type !== 'edit_suggestion') {
        if (!map.has(s.documentId)) map.set(s.documentId, []);
        map.get(s.documentId).push(s);
      }
    }
    return map;
  }, [allSuggestions]);

  const getUnvotedCount = useMemo(() => (docId) => {
    if (!user?.id) return 0;
    const pending = pendingSuggestionsByDocId.get(docId) || [];
    return pending.filter(s => !votedSuggestionIds.has(s.id)).length;
  }, [pendingSuggestionsByDocId, votedSuggestionIds, user?.id]);

  return {
    user,
    myDocuments,
    suggestions,
    allSuggestions,
    allVotes: votes,
    allUsers,
    allComments,
    allSections,
    votes,
    isLoading: interactionsLoading || documentsLoading,
    getUnvotedCount,
  };
}