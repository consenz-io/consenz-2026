import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Provides a mutation to reorder a new-section suggestion by updating its insertPosition.
 * Includes optimistic updates so the card moves immediately on drag.
 */
export function useSuggestionReorder(documentId) {
  const queryClient = useQueryClient();

  const reorderMutation = useMutation({
    mutationFn: async ({ suggestionId, newInsertPosition }) => {
      return base44.entities.Suggestion.update(suggestionId, {
        insertPosition: newInsertPosition,
      });
    },
    onMutate: async ({ suggestionId, newInsertPosition }) => {
      await queryClient.cancelQueries({ queryKey: ["suggestions", documentId] });
      const previous = queryClient.getQueryData(["suggestions", documentId]);
      queryClient.setQueryData(["suggestions", documentId], (old) =>
        (old || []).map((s) =>
          s.id === suggestionId ? { ...s, insertPosition: newInsertPosition } : s
        )
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["suggestions", documentId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions", documentId] });
    },
  });

  return { reorderMutation };
}