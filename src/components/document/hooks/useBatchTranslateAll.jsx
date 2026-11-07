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

// Must match MAX_UNITS in base44/functions/batchTranslateVersions.
const MAX_UNITS_PER_BATCH = 50;

/**
 * Builds a handler that pre-populates the React Query translation cache for
 * every translatable unit rendered on the document page — title, description,
 * topic titles, section contents, proposal texts and explanations, and all
 * comments — then activates `globalShowTranslated`.
 *
 * Units whose source language already matches the target language are skipped,
 * so nothing is sent twice and nothing is translated needlessly.
 */
export function useBatchTranslateAll({ document, topics, sections, suggestions, comments }) {
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
    const seen = new Set();

    const add = (unit) => {
      if (!unit.content || typeof unit.content !== 'string' || !unit.content.trim()) return;
      const key = `${unit.sourceEntityType}:${unit.sourceEntityId}:${unit.sourceField}`;
      if (seen.has(key)) return;
      const sourceLanguage = unit.sourceLanguage || detectLanguage(unit.content);
      // Only units whose source language differs from the target need translation
      if (sourceLanguage === targetLanguage) return;
      seen.add(key);
      units.push({ ...unit, sourceLanguage });
    };

    // Document title + description
    if (document.title) {
      add({
        sourceEntityType: 'document',
        sourceEntityId: document.id,
        sourceField: 'title',
        content: document.title,
        isHtml: false,
      });
    }
    if (document.description) {
      add({
        sourceEntityType: 'document',
        sourceEntityId: document.id,
        sourceField: 'description',
        content: document.description,
        isHtml: true,
      });
    }

    // Topic titles
    for (const topic of topics || []) {
      add({
        sourceEntityType: 'topic',
        sourceEntityId: topic.id,
        sourceField: 'title',
        content: topic.title,
        isHtml: false,
      });
    }

    // Section contents
    for (const section of sections || []) {
      add({
        sourceEntityType: 'section',
        sourceEntityId: section.id,
        sourceField: 'content',
        content: section.content,
        isHtml: true,
      });
    }

    // Proposal texts + explanations
    for (const suggestion of suggestions || []) {
      const suggestionLanguage =
        suggestion.createdByLanguage || suggestion.originalLanguage || detectLanguage(suggestion.newContent || '');
      add({
        sourceEntityType: 'suggestion',
        sourceEntityId: suggestion.id,
        sourceField: 'newContent',
        content: suggestion.newContent,
        isHtml: true,
        sourceLanguage: suggestionLanguage,
      });
      add({
        sourceEntityType: 'suggestion',
        sourceEntityId: suggestion.id,
        sourceField: 'explanation',
        content: suggestion.explanation,
        isHtml: false,
        sourceLanguage: suggestionLanguage,
      });
    }

    // Comments (document, section and proposal threads)
    for (const comment of comments || []) {
      add({
        sourceEntityType: 'comment',
        sourceEntityId: comment.id,
        sourceField: 'content',
        content: comment.content,
        isHtml: false,
        sourceLanguage: comment.originalLanguage || detectLanguage(comment.content),
      });
    }

    if (units.length === 0) {
      setGlobalShowTranslated(true);
      return;
    }

    setIsTranslatingAll(true);

    try {
      // Chunk to respect the backend MAX_UNITS limit. A chunk that fails must
      // not abort the rest — anything left untranslated is picked up by the
      // per-unit hooks.
      const allResults = [];
      for (let i = 0; i < units.length; i += MAX_UNITS_PER_BATCH) {
        const chunk = units.slice(i, i + MAX_UNITS_PER_BATCH);
        try {
          const result = await base44.functions.invoke('batchTranslateVersions', {
            documentId: document.id,
            targetLanguage,
            units: chunk,
          });
          allResults.push(...(result.data?.results || []));
        } catch (err) {
          console.error('Batch translation chunk failed:', err);
        }
      }

      // Build a lookup from the original units so we can hash the content
      // for each result (the backend result doesn't include the original content).
      const contentLookup = new Map();
      for (const u of units) {
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
    } finally {
      setIsTranslatingAll(false);
      // Always switch the page into translated view, even when some units
      // failed — the per-unit hooks fill in whatever is still missing.
      setGlobalShowTranslated(true);
    }
  }, [document, topics, sections, suggestions, comments, targetLanguage, queryClient, setGlobalShowTranslated, setIsTranslatingAll]);
}