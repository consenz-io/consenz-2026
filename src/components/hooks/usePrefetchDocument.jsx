import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { queryKeys, QUERY_STALE_TIMES } from '@/components/config/queryConfig';

// Hook to prefetch document data when hovering over a link
export function usePrefetchDocument() {
  const queryClient = useQueryClient();

  const prefetchDocument = (documentId) => {
    if (!documentId) return;

    // Prefetch document and related data
    queryClient.prefetchQuery({
      queryKey: queryKeys.document(documentId),
      queryFn: () => base44.entities.Document.filter({ id: documentId }).then(docs => docs[0]),
      staleTime: QUERY_STALE_TIMES.DOCUMENT_METADATA,
    });

    queryClient.prefetchQuery({
      queryKey: queryKeys.topics(documentId),
      queryFn: () => base44.entities.Topic.filter({ documentId }),
      staleTime: QUERY_STALE_TIMES.TOPICS,
    });

    queryClient.prefetchQuery({
      queryKey: queryKeys.sections(documentId),
      queryFn: () => base44.entities.Section.filter({ documentId }),
      staleTime: QUERY_STALE_TIMES.SECTIONS,
    });
  };

  return { prefetchDocument };
}