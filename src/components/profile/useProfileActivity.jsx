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

  const acceptedSuggestions = useMemo(
    () => userSuggestions.filter((s) => s.status === 'accepted'),
    [userSuggestions]
  );

  return {
    userSuggestions,
    userComments,
    acceptedSuggestions,
    isLoading: isLoadingSuggestions || isLoadingComments,
  };
}