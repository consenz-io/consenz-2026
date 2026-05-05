import { useMemo } from "react";
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

  const { data: allVotes = [] } = useQuery({
    queryKey: ['allVotesForDocs', myDocumentIds],
    queryFn: async () => {
      if (myDocumentIds.length === 0) return [];
      const suggestionIds = allSuggestions.map(s => s.id);
      if (suggestionIds.length === 0) return [];
      return base44.entities.Vote.filter({ suggestionId: { $in: suggestionIds } });
    },
    enabled: !!user?.id && allSuggestions.length > 0,
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

  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments', myDocumentIds],
    queryFn: async () => {
      if (myDocumentIds.length === 0) return [];
      const suggestionIds = allSuggestions.map(s => s.id);
      const sectionIds = allSections.map(s => s.id);
      if (suggestionIds.length === 0 && sectionIds.length === 0) return [];
      return base44.entities.Comment.filter({
        rootEntityId: { $in: [...suggestionIds, ...sectionIds, ...myDocumentIds] }
      });
    },
    enabled: !!user?.id && myDocumentIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // Derive the full set of my documents (including voted ones)
  const myDocuments = useMemo(() => {
    const votedSuggestions = allSuggestions.filter(s => allVotes.some(v => v.suggestionId === s.id));
    const votedDocIds = votedSuggestions.map(s => s.documentId);
    const allMyIds = new Set([...myDocumentIds, ...votedDocIds]);
    return allDocuments.filter(doc => allMyIds.has(doc.id));
  }, [allDocuments, myDocumentIds, allSuggestions, allVotes]);

  const getUnvotedCount = (docId) => {
    if (!user?.id) return 0;
    const pending = allSuggestions.filter(s =>
      s.documentId === docId && s.status === 'pending' && s.type !== 'edit_suggestion'
    );
    return pending.filter(s => !votes.some(v => v.suggestionId === s.id)).length;
  };

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