import { useState, useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";

const detectLanguage = (text) => {
  if (!text) return 'en';
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
};

/**
 * FNV-1a 32-bit hash — matches the backend hashContent in translationVersioning.ts.
 * Used in the React Query key so the cache invalidates when source content changes.
 */
const hashContent = (content) => {
  if (!content) return "0";
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

/**
 * Hook for version-aware translation of a single content unit.
 *
 * Calls the `translateVersion` backend function, which manages canonical
 * translations in the Translation entity. Two users requesting the same
 * version+language get the same translation.
 *
 * The translation result is cached in React Query keyed by content hash,
 * so toggling between original and translated doesn't re-call the backend.
 * When the source content changes, the cache key changes, and the next
 * translate call will produce a fresh translation (the backend marks the
 * old one as stale).
 *
 * @param {object} params
 * @param {string} params.documentId         - Parent document ID (for authorization)
 * @param {string} params.sourceEntityType    - section | version | suggestion | document | topic | comment
 * @param {string} params.sourceEntityId      - ID of the source entity
 * @param {string} [params.sourceField]       - Which field is being translated (default: 'content')
 * @param {string} params.content             - The source text to translate
 * @param {boolean} [params.isHtml]           - Whether the content is HTML (default: false)
 * @param {string} [params.sourceLanguage]    - Source language code (auto-detected if omitted)
 * @param {boolean} [params.globalShowTranslated] - When true, show translated content (synced with "Translate All")
 *
 * @returns {object} { translatedContent, showTranslated, setShowTranslated, isTranslating, translate, handleToggle, needsTranslation, targetLanguage, sourceLanguage }
 */
export function useVersionTranslation({
  documentId,
  sourceEntityType,
  sourceEntityId,
  sourceField = 'content',
  content,
  isHtml = false,
  sourceLanguage: explicitSourceLanguage,
  globalShowTranslated = false,
}) {
  const { language: targetLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const [localShowTranslated, setLocalShowTranslated] = useState(false);

  const sourceLanguage = explicitSourceLanguage || detectLanguage(content);
  const needsTranslation = sourceLanguage !== targetLanguage && !!content && !!documentId;

  const contentHash = useMemo(() => hashContent(content), [content]);

  const queryKey = useMemo(
    () => ['versionTranslation', documentId, sourceEntityType, sourceEntityId, sourceField, targetLanguage, contentHash],
    [documentId, sourceEntityType, sourceEntityId, sourceField, targetLanguage, contentHash]
  );

  // Cache the translation result — populated by the mutation, read by all
  // instances translating the same version+language+content. enabled:false
  // means we only read from cache; the mutation populates it.
  const { data: translatedContent } = useQuery({
    queryKey,
    enabled: false,
    staleTime: Infinity,
  });

  // Sync with global "Translate All" state — when the global toggle is on,
  // show translated content for all units that have a cached translation.
  useEffect(() => {
    if (globalShowTranslated) {
      setLocalShowTranslated(true);
    }
  }, [globalShowTranslated]);

  const translateMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('translateVersion', {
        documentId,
        sourceEntityType,
        sourceEntityId,
        sourceField,
        sourceLanguage,
        targetLanguage,
        content,
        isHtml,
      });
      return result.data?.translatedContent || content;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      setLocalShowTranslated(true);
    },
  });

  const handleToggle = useCallback(() => {
    if (translatedContent) {
      setLocalShowTranslated(prev => !prev);
    } else {
      translateMutation.mutate();
    }
  }, [translatedContent, translateMutation]);

  const showTranslated = localShowTranslated;

  return {
    translatedContent: translatedContent || null,
    showTranslated,
    setShowTranslated: setLocalShowTranslated,
    isTranslating: translateMutation.isPending,
    translate: translateMutation.mutate,
    handleToggle,
    needsTranslation,
    targetLanguage,
    sourceLanguage,
  };
}