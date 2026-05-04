import React, { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Sets up all real-time subscriptions for DocumentView.
 * Extracted from DocumentView to keep the page component lean.
 */
export function useDocumentSubscriptions(documentId, document, documentMetadata) {
  const queryClient = useQueryClient();

  // Keep refs for subscription callbacks (avoid stale closures without causing re-subscriptions)
  const topicsRef = React.useRef([]);
  const sectionsRef = React.useRef([]);
  const suggestionsRef = React.useRef([]);

  // Stable setter functions — defined once, never change reference
  // (inline arrow functions would create a new reference on every render)
  const setTopicsRef = React.useCallback((v) => { topicsRef.current = v; }, []);
  const setSectionsRef = React.useCallback((v) => { sectionsRef.current = v; }, []);
  const setSuggestionsRef = React.useCallback((v) => { suggestionsRef.current = v; }, []);

  // Document subscription — only needs documentId, not the document object
  React.useEffect(() => {
    if (!documentId) return;
    const unsubscribe = base44.entities.Document.subscribe((event) => {
      if (event.id === documentId) {
        queryClient.invalidateQueries({ queryKey: ['document', documentId] });
        queryClient.invalidateQueries({ queryKey: ['documentMetadata', documentId] });
      }
    });
    return unsubscribe;
  }, [documentId, queryClient]);

  // Topics / Sections / Suggestions subscriptions — debounced
  React.useEffect(() => {
    if (!documentId) return;

    const timers = { topics: null, sections: null, suggestions: null };
    const debouncedInvalidate = (queryKey) => {
      const key = queryKey[0];
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
      }, 300);
    };

    const unsubscribeTopic = base44.entities.Topic.subscribe((event) => {
      if (event.data?.documentId === documentId ||
          (event.type === 'update' && event.id && topicsRef.current?.some(t => t.id === event.id))) {
        debouncedInvalidate(['topics', documentId]);
      }
    });

    const unsubscribeSection = base44.entities.Section.subscribe((event) => {
      if (event.data?.documentId === documentId ||
          (event.type === 'update' && event.id && sectionsRef.current?.some(s => s.id === event.id))) {
        debouncedInvalidate(['sections', documentId]);
      }
    });

    const unsubscribeSuggestion = base44.entities.Suggestion.subscribe((event) => {
      if (event.data?.documentId === documentId ||
          (event.type === 'update' && event.id && suggestionsRef.current?.some(s => s.id === event.id))) {
        debouncedInvalidate(['suggestions', documentId]);
        queryClient.invalidateQueries({ queryKey: ['documentAggregatedData', documentId] });
      }
    });

    return () => {
      Object.values(timers).forEach(t => clearTimeout(t));
      unsubscribeTopic();
      unsubscribeSection();
      unsubscribeSuggestion();
    };
  }, [documentId, queryClient]);

  // Comment subscription
  React.useEffect(() => {
    if (!documentId) return;
    const unsubscribe = base44.entities.Comment.subscribe((event) => {
      if (event.data?.rootEntityType === 'document' && event.data?.rootEntityId === documentId) {
        queryClient.invalidateQueries({ queryKey: ['documentAggregatedData', documentId] });
      }
      if (event.data?.rootEntityType && event.data?.rootEntityId) {
        queryClient.invalidateQueries({ queryKey: ['comments', event.data.rootEntityType, event.data.rootEntityId] });
      }
    });
    return unsubscribe;
  }, [documentId, queryClient]);

  // Agreement / Version subscriptions
  React.useEffect(() => {
    if (!documentId) return;

    const unsubscribeAgreement = base44.entities.DocumentAgreement.subscribe((event) => {
      if (event.data?.documentId === documentId ||
          (event.type === 'delete' && documentMetadata?.agreements?.some(a => a.id === event.id))) {
        queryClient.invalidateQueries({ queryKey: ['documentMetadata', documentId] });
      }
    });

    const unsubscribeVersion = base44.entities.DocumentVersion.subscribe((event) => {
      if (event.data?.documentId === documentId) {
        queryClient.invalidateQueries({ queryKey: ['documentMetadata', documentId] });
      }
    });

    return () => {
      unsubscribeAgreement();
      unsubscribeVersion();
    };
  // documentMetadata intentionally excluded — it changes every refetch and would
  // cause unnecessary re-subscription. The delete-check fallback is a nice-to-have,
  // not critical — the invalidation on create/update is sufficient.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, queryClient]);

  return { setTopicsRef, setSectionsRef, setSuggestionsRef };
}