import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { queryKeys, QUERY_STALE_TIMES } from '@/components/config/queryConfig';

// Prefetch document data when component mounts
export function useDocumentPrefetch(documentId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!documentId) return;

    // Prefetch related data in parallel
    const prefetchAll = async () => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.topics(documentId),
          queryFn: () => base44.entities.Topic.filter({ documentId }),
          staleTime: QUERY_STALE_TIMES.TOPICS,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.sections(documentId),
          queryFn: () => base44.entities.Section.filter({ documentId }),
          staleTime: QUERY_STALE_TIMES.SECTIONS,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.suggestions(documentId),
          queryFn: () => base44.entities.Suggestion.filter({ documentId }),
          staleTime: QUERY_STALE_TIMES.SUGGESTIONS,
        }),
      ]);
    };

    prefetchAll().catch(err => {
      console.warn('[PREFETCH] Failed to prefetch document data:', err);
    });
  }, [documentId, queryClient]);
}