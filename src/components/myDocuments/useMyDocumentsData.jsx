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

  const { data: votes = [] } = useQuery({
    queryKey: ['myVotes', user?.id],
    queryFn: () => base44.entities.Vote.filter({ userId: user.id }),
    enabled: !!user?.id,
  });

  // Voted suggestion IDs — to look up their docIds
  const votedSuggestionIdsList = useMemo(() => votes.map(v => v.suggestionId).sort(), [votes]);

  // Fetch the suggestions the user voted on to get their document IDs
  const { data: votedSuggestions = [] } = useQuery({
    queryKey: ['votedSuggestions', votedSuggestionIdsList],
    queryFn: () => votedSuggestionIdsList.length > 0
      ? base44.entities.Suggestion.filter({ id: { $in: votedSuggestionIdsList } }, null, 500)
      : Promise.resolve([]),
    enabled: !!user?.id && votedSuggestionIdsList.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const myDocumentIds = useMemo(() => {
    const suggestedDocIds = suggestions.map(s => s.documentId);
    const interactedDocIds = userInteractions.map(ui => ui.documentId);
    const createdDocIds = allDocuments.filter(d => d.created_by === user?.email).map(d => d.id);
    const votedDocIds = votedSuggestions.map(s => s.documentId);
    return [...new Set([...interactedDocIds, ...suggestedDocIds, ...createdDocIds, ...votedDocIds])].sort();
  }, [suggestions, userInteractions, allDocuments, user?.email, votedSuggestions]);

  const { data: allSuggestions = [] } = useQuery({
    queryKey: ['allSuggestions', myDocumentIds],
    queryFn: () => myDocumentIds.length > 0
      ? base44.entities.Suggestion.filter({ documentId: { $in: myDocumentIds } })
      : Promise.resolve([]),
    enabled: !!user?.id && myDocumentIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const allSuggestionIds = useMemo(() => allSuggestions.map(s => s.id).sort(), [allSuggestions]);

  const { data: allVotes = [] } = useQuery({
    queryKey: ['allVotesForDocs', allSuggestionIds],
    queryFn: () => base44.entities.Vote.filter({ suggestionId: { $in: allSuggestionIds } }),
    enabled: !!user?.id && allSuggestionIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

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

  const allSectionIds = useMemo(() => allSections.map(s => s.id).sort(), [allSections]);

  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments', allSuggestionIds, allSectionIds, myDocumentIds],
    queryFn: () => {
      const allIds = [...allSuggestionIds, ...allSectionIds, ...myDocumentIds];
      if (allIds.length === 0) return Promise.resolve([]);
      return base44.entities.Comment.filter({ rootEntityId: { $in: allIds } });
    },
    enabled: !!user?.id && myDocumentIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // Derive the full set of my documents — myDocumentIds already includes voted doc IDs
  const myDocuments = useMemo(() => {
    const allMyIds = new Set(myDocumentIds);
    return allDocuments.filter(doc => allMyIds.has(doc.id));
  }, [allDocuments, myDocumentIds]);

  const votedIds = useMemo(() => new Set(votedSuggestionIdsList), [votedSuggestionIdsList]);

  const getUnvotedCount = useCallback((docId) => {
    if (!user?.id) return 0;
    const now = new Date();
    const active = allSuggestions.filter(s =>
      s.documentId === docId &&
      s.status === 'pending' &&
      s.type !== 'edit_suggestion' &&
      s.created_by !== user.email &&
      (!s.timerEndsAt || new Date(s.timerEndsAt) > now)
    );
    return active.filter(s => !votedIds.has(s.id)).length;
  }, [user?.id, user?.email, allSuggestions, votedIds]);

  return {
    user,
    myDocuments,
    suggestions,
    allSuggestions,
    allVotes,
    allUsers,
    allComments,
    allSections,
    votes,
    isLoading: interactionsLoading || documentsLoading,
    getUnvotedCount,
  };
}