/**
 * Version identity and canonical key utilities for the translation system.
 *
 * The core principle: a translation belongs to a specific VERSION of a source
 * content unit, not to the entity itself and not to the user who requested it.
 * Two users viewing the same version in the same language see the same translation.
 *
 * A "version" is any immutable snapshot of text:
 *   - The current content of a Section  → section:{sectionId}:current
 *   - A past DocumentVersion record      → version:{versionId}
 *   - The original text in a Suggestion   → suggestion:{suggestionId}:original
 *   - The proposed text in a Suggestion   → suggestion:{suggestionId}:proposed
 *   - Document title                      → document:{documentId}:title
 *   - Document description                → document:{documentId}:description
 *   - Topic title                         → topic:{topicId}:title
 *   - Comment content                     → comment:{commentId}:content
 *
 * When a suggestion is accepted and a new section version is created, it gets
 * a NEW sourceVersionId. Translations of the old version remain unchanged.
 */

export type SourceEntityType =
  | "section"
  | "version"
  | "suggestion"
  | "document"
  | "topic"
  | "comment";

export interface VersionIdParts {
  sourceEntityType: SourceEntityType;
  sourceEntityId: string;
  sourceField: string;
}

/**
 * Build a stable, language-independent version identifier.
 *
 * Examples:
 *   buildVersionId("section", "abc123", "content")  → "section:abc123:current"
 *   buildVersionId("version", "v456", "content")     → "version:v456"
 *   buildVersionId("suggestion", "s789", "newContent") → "suggestion:s789:proposed"
 *   buildVersionId("suggestion", "s789", "originalContent") → "suggestion:s789:original"
 *   buildVersionId("document", "d1", "title")         → "document:d1:title"
 */
export function buildVersionId(
  sourceEntityType: SourceEntityType,
  sourceEntityId: string,
  sourceField: string
): string {
  // For sections, the "current" version is the live Section record.
  // We use the literal "current" to distinguish from DocumentVersion records.
  if (sourceEntityType === "section") {
    return `section:${sourceEntityId}:current`;
  }

  // For DocumentVersion records, the versionId IS the record id.
  if (sourceEntityType === "version") {
    return `version:${sourceEntityId}`;
  }

  // For suggestions, the field name determines which text: proposed vs original.
  if (sourceEntityType === "suggestion") {
    if (sourceField === "newContent") return `suggestion:${sourceEntityId}:proposed`;
    if (sourceField === "originalContent") return `suggestion:${sourceEntityId}:original`;
    if (sourceField === "explanation") return `suggestion:${sourceEntityId}:explanation`;
    if (sourceField === "title") return `suggestion:${sourceEntityId}:title`;
    // Fallback: use the field name directly
    return `suggestion:${sourceEntityId}:${sourceField}`;
  }

  // For documents, topics, comments — include the field name.
  return `${sourceEntityType}:${sourceEntityId}:${sourceField}`;
}

/**
 * Parse a version identifier back into its parts.
 */
export function parseVersionId(versionId: string): VersionIdParts | null {
  const parts = versionId.split(":");
  if (parts.length < 3) return null;

  const sourceEntityType = parts[0] as SourceEntityType;
  const sourceEntityId = parts[1];

  if (sourceEntityType === "section") {
    // section:{id}:current — the third part is always "current"
    return { sourceEntityType, sourceEntityId, sourceField: "content" };
  }

  if (sourceEntityType === "version") {
    // version:{id} — no field suffix, defaults to content
    return { sourceEntityType, sourceEntityId, sourceField: "content" };
  }

  if (sourceEntityType === "suggestion") {
    // suggestion:{id}:proposed|original|explanation|title
    const suffix = parts.slice(2).join(":");
    const fieldMap: Record<string, string> = {
      proposed: "newContent",
      original: "originalContent",
      explanation: "explanation",
      title: "title",
    };
    return {
      sourceEntityType,
      sourceEntityId,
      sourceField: fieldMap[suffix] || suffix,
    };
  }

  // document:{id}:title, topic:{id}:title, comment:{id}:content
  const sourceField = parts.slice(2).join(":");
  return { sourceEntityType, sourceEntityId, sourceField };
}

/**
 * Compute a short hash of source content for staleness detection.
 * Uses a simple FNV-1a hash to avoid crypto dependencies in the edge runtime.
 * The hash is NOT for security — it's just to detect if the source text changed
 * since the translation was created.
 */
export function hashContent(content: string): string {
  if (!content) return "0";

  // FNV-1a 32-bit hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    // Multiply by FNV prime (0x01000193) with 32-bit overflow
    hash = Math.imul(hash, 0x01000193);
  }

  // Convert to unsigned hex string
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * The canonical lookup key for a translation record.
 * One translation per (versionId + targetLanguage).
 */
export function translationKey(
  sourceVersionId: string,
  targetLanguage: string
): string {
  return `${sourceVersionId}|${targetLanguage}`;
}

/**
 * Supported languages in the system.
 */
export const SUPPORTED_LANGUAGES = ["en", "he", "ar"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic",
};

/**
 * Detect the language of a text by its script.
 * Hebrew → he, Arabic → ar, everything else → en.
 */
export function detectLanguage(text: string): SupportedLanguage {
  if (!text) return "en";
  if (/[\u0590-\u05FF]/.test(text)) return "he";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  return "en";
}

/**
 * Check if a translation is needed between two languages.
 */
export function needsTranslation(
  sourceLanguage: string,
  targetLanguage: string
): boolean {
  return sourceLanguage !== targetLanguage;
}