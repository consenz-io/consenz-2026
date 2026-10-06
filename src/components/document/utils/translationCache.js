/**
 * FNV-1a 32-bit hash — matches the backend hashContent in translationVersioning.ts.
 * Used in the React Query key so the cache invalidates when source content changes.
 *
 * Shared between useVersionTranslation (per-unit hook) and useBatchTranslateAll
 * (batch pre-population) so both build identical cache keys.
 */
export const hashContent = (content) => {
  if (!content) return "0";
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

/**
 * Build the React Query cache key for a translation unit.
 * Must match the key built in useVersionTranslation's useQuery.
 */
export const buildTranslationCacheKey = (
  documentId,
  sourceEntityType,
  sourceEntityId,
  sourceField,
  targetLanguage,
  content
) => [
  'versionTranslation',
  documentId,
  sourceEntityType,
  sourceEntityId,
  sourceField,
  targetLanguage,
  hashContent(content),
];