import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { queryKeys, invalidateQueries } from '@/components/config/queryConfig';
import { toast } from 'sonner';

// Optimistic mutation for updating suggestion status
export function useUpdateSuggestionStatus(documentId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ suggestionId, status }) => {
      await base44.entities.Suggestion.update(suggestionId, { status });
    },
    onMutate: async ({ suggestionId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.suggestions(documentId) });
      
      const previousSuggestions = queryClient.getQueryData(queryKeys.suggestions(documentId));
      
      queryClient.setQueryData(queryKeys.suggestions(documentId), (old = []) =>
        old.map(s => s.id === suggestionId ? { ...s, status } : s)
      );
      
      return { previousSuggestions };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(queryKeys.suggestions(documentId), context.previousSuggestions);
      toast.error('שגיאה בעדכון סטטוס ההצעה');
    },
    onSuccess: (_, { suggestionId }) => {
      invalidateQueries.suggestion(queryClient, documentId, suggestionId);
    },
  });
}

// Optimistic mutation for deleting comments
export function useDeleteComment(entityType, entityId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId) => {
      await base44.entities.Comment.delete(commentId);
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments(entityType, entityId) });
      
      const previousComments = queryClient.getQueryData(queryKeys.comments(entityType, entityId));
      
      queryClient.setQueryData(queryKeys.comments(entityType, entityId), (old = []) =>
        old.filter(c => c.id !== commentId)
      );
      
      return { previousComments };
    },
    onError: (err, commentId, context) => {
      queryClient.setQueryData(queryKeys.comments(entityType, entityId), context.previousComments);
      toast.error('שגיאה במחיקת תגובה');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(entityType, entityId) });
      toast.success('התגובה נמחקה');
    },
  });
}