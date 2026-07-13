import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { base44 } from "@/api/base44Client";

export function useProfileActivity(userId) {
  const { data: userSuggestions = [], isLoading: isLoadingSuggestions } = useQuery({
    queryKey: ['userSuggestions', userId],
    queryFn: () => base44.entities.Suggestion.filter({ created_by_id: userId }, '-created_date', 50),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const { data: userComments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ['userComments', userId],
    queryFn: () => base44.entities.Comment.filter({ created_by_id: userId }, '-created_date', 50),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  // Fetch titles for the documents referenced by the user's suggestions
  const documentIds = useMemo(
    () => Array.from(new Set(userSuggestions.map((s) => s.documentId).filter(Boolean))),
    [userSuggestions]
  );

  const { data: documents = [] } = useQuery({
    queryKey: ['profileActivityDocuments', documentIds],
    queryFn: () => base44.entities.Document.filter({ id: { $in: documentIds } }),
    enabled: documentIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const documentTitleById = useMemo(() => {
    const map = {};
    documents.forEach((d) => { map[d.id] = d.title; });
    return map;
  }, [documents]);

  const enrichedSuggestions = useMemo(
    () => userSuggestions.map((s) => ({ ...s, documentTitle: documentTitleById[s.documentId] })),
    [userSuggestions, documentTitleById]
  );

  const acceptedSuggestions = useMemo(
    () => enrichedSuggestions.filter((s) => s.status === 'accepted'),
    [enrichedSuggestions]
  );

  return {
    userSuggestions: enrichedSuggestions,
    userComments,
    acceptedSuggestions,
    isLoading: isLoadingSuggestions || isLoadingComments,
  };
}