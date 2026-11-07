import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { useDocumentTranslation } from "../TranslationContext";
import { buildTranslationCacheKey } from "../utils/translationCache";

const detectLanguage = (text) => {
  if (!text) return 'en';
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
};

const MAX_UNITS_PER_BATCH = 100;

/**
 * Builds a handler that pre-populates React Query translation cache for ALL
 * translatable units in the document via a single `batchTranslateVersions`
 * call, then activates `globalShowTranslated`.
 *
 * This replaces the old flow where each useVersionTranslation instance fired
 * its own `translateVersion` call on `globalShowTranslated` change (N parallel
 * HTTP requests). Now: 1 batch request → populate N cache entries → toggle.
 * The per-unit hooks find cached `translatedContent` and skip their mutation.
 *
 * @param {object} params
 * @param {object} params.document  - Document record (needs id, title, description, originalLanguage)
 * @param {array}  params.topics    - Topic records (needs id, title, originalLanguage)
 * @param {array}  params.sections  - Section records (needs id, content, originalLanguage)
 * @returns {function} async handler — call when "Translate All" is activated
 */
export function useBatchTranslateAll({ document, topics, sections }) {
  const { language: targetLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const { setGlobalShowTranslated, setIsTranslatingAll } = useDocumentTranslation();

  return useCallback(async () => {
    if (!document?.id) {
      setGlobalShowTranslated(true);
      return;
    }

    // Collect all translatable units rendered in the document tree.
    // Each unit's sourceEntityType/sourceField/sourceEntityId must exactly
    // match what the corresponding useVersionTranslation call uses, so the
    // cache key we populate matches the key the hook reads.
    const units = [];

    // Document title (DocumentHeader)
    if (document.title) {
      units.push({
        sourceEntityType: 'document',
        sourceEntityId: document.id,
        sourceField: 'title',
        content: document.title,
        isHtml: false,
        sourceLanguage: document.originalLanguage || detectLanguage(document.title),
      });
    }

    // Document description (DocumentDescription)
    if (document.description) {
      units.push({
        sourceEntityType: 'document',
        sourceEntityId: document.id,
        sourceField: 'description',
        content: document.description,
        isHtml: true,
        sourceLanguage: document.originalLanguage || detectLanguage(document.description),
      });
    }

    // Topic titles (DocumentTopicCard)
    for (const topic of topics || []) {
      if (topic.title) {
        units.push({
          sourceEntityType: 'topic',
          sourceEntityId: topic.id,
          sourceField: 'title',
          content: topic.title,
          isHtml: false,
          sourceLanguage: topic.originalLanguage || detectLanguage(topic.title),
        });
      }
    }

    // Section contents (TranslatableContent via TopicSections)
    for (const section of sections || []) {
      if (section.content) {
        units.push({
          sourceEntityType: 'section',
          sourceEntityId: section.id,
          sourceField: 'content',
          content: section.content,
          isHtml: true,
          sourceLanguage: section.originalLanguage || detectLanguage(section.content),
        });
      }
    }

    // Only units whose source language differs from the target need translation
    const translatable = units.filter(u => u.sourceLanguage !== targetLanguage);

    if (translatable.length === 0) {
      setGlobalShowTranslated(true);
      return;
    }

    setIsTranslatingAll(true);

    try {
      // Chunk to respect the backend MAX_UNITS limit (100)
      const allResults = [];
      for (let i = 0; i < translatable.length; i += MAX_UNITS_PER_BATCH) {
        const chunk = translatable.slice(i, i + MAX_UNITS_PER_BATCH);
        const result = await base44.functions.invoke('batchTranslateVersions', {
          documentId: document.id,
          targetLanguage,
          units: chunk,
        });
        const chunkResults = result.data?.results || [];
        allResults.push(...chunkResults);
      }

      // Build a lookup from the original units so we can hash the content
      // for each result (the backend result doesn't include the original content).
      const contentLookup = new Map();
      for (const u of translatable) {
        contentLookup.set(`${u.sourceEntityType}:${u.sourceEntityId}:${u.sourceField}`, u.content);
      }

      // Populate React Query cache for each successfully translated unit.
      // This must happen BEFORE setGlobalShowTranslated(true) so the per-unit
      // hooks see translatedContent as truthy and skip their own mutation.
      for (const r of allResults) {
        if (!r.translatedContent || r.status === 'failed') continue;
        const key = `${r.sourceEntityType}:${r.sourceEntityId}:${r.sourceField}`;
        const content = contentLookup.get(key);
        if (!content) continue;
        const cacheKey = buildTranslationCacheKey(
          document.id,
          r.sourceEntityType,
          r.sourceEntityId,
          r.sourceField,
          targetLanguage,
          content
        );
        queryClient.setQueryData(cacheKey, r.translatedContent);
      }

      setGlobalShowTranslated(true);
    } catch (err) {
      // Fallback: activate per-unit translation (the old N-requests path)
      console.error('Batch translation failed, falling back to per-unit:', err);
      setGlobalShowTranslated(true);
    } finally {
      setIsTranslatingAll(false);
    }
  }, [document, topics, sections, targetLanguage, queryClient, setGlobalShowTranslated, setIsTranslatingAll]);
}