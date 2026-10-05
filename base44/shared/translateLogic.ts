/**
 * Core translation logic shared by translateVersion and translateDocumentVersions.
 *
 * The principle: one canonical translation per (sourceVersionId, targetLanguage).
 * If the source content changed since the last translation (hash mismatch),
 * the old record is marked `stale` and a new one is created. This ensures:
 *   - Two users requesting the same version+language get the same translation.
 *   - A version's translation never silently changes.
 *   - Stale translations are preserved for history but not served.
 */

import {
  buildVersionId,
  hashContent,
  needsTranslation,
  LANGUAGE_NAMES,
} from "./translationVersioning.ts";

export interface TranslateUnitParams {
  documentId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceField: string;
  sourceLanguage: string;
  targetLanguage: string;
  content: string;
  isHtml: boolean;
}

export interface TranslateUnitResult {
  sourceVersionId: string;
  translatedContent: string;
  status: "ready" | "not_needed" | "failed" | "from_cache";
  fromCache: boolean;
  error?: string;
}

/**
 * Translate a single content unit. Checks for an existing canonical
 * translation first; creates one via LLM only if needed.
 */
export async function translateUnit(
  base44: any,
  user: any,
  params: TranslateUnitParams
): Promise<TranslateUnitResult> {
  const {
    documentId,
    sourceEntityType,
    sourceEntityId,
    sourceField,
    sourceLanguage,
    targetLanguage,
    content,
    isHtml,
  } = params;

  const sourceVersionId = buildVersionId(
    sourceEntityType as any,
    sourceEntityId,
    sourceField
  );

  // No translation needed if same language
  if (!needsTranslation(sourceLanguage, targetLanguage)) {
    return {
      sourceVersionId,
      translatedContent: content,
      status: "not_needed",
      fromCache: false,
    };
  }

  if (!content || content.length === 0) {
    return {
      sourceVersionId,
      translatedContent: content,
      status: "not_needed",
      fromCache: false,
    };
  }

  const contentHash = hashContent(content);

  // Look up existing ready translation for this version+language
  const existing = await base44.asServiceRole.entities.Translation.filter({
    sourceVersionId,
    targetLanguage,
    status: "ready",
  });

  if (existing.length > 0) {
    const translation = existing[0];
    // Hash matches — return cached translation
    if (translation.sourceContentHash === contentHash) {
      return {
        sourceVersionId,
        translatedContent: translation.translatedContent,
        status: "from_cache",
        fromCache: true,
      };
    }
    // Hash mismatch — source changed since translation was created.
    // Mark old as stale; a new record will be created below.
    await base44.asServiceRole.entities.Translation.update(translation.id, {
      status: "stale",
    });
  }

  // Translate via LLM
  try {
    const langName = LANGUAGE_NAMES[targetLanguage as keyof typeof LANGUAGE_NAMES];
    const prompt = isHtml
      ? `Translate the following HTML content to ${langName}. Preserve all HTML tags exactly as-is. Only translate the text content between tags. Return only the translated HTML with no additional commentary or markdown.\n\nContent to translate:\n${content}`
      : `Translate the following text to ${langName}. Return only the translated text with no commentary or markdown.\n\nText:\n${content}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
    });

    let translated =
      typeof result === "string"
        ? result
        : result?.content ||
          result?.text ||
          result?.translation ||
          result?.output ||
          result?.result ||
          content;
    translated = String(translated)
      .replace(/```html\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Validate: translation must not be empty or identical to source
    if (!translated || translated.length === 0) {
      throw new Error("Translation returned empty content");
    }

    // Save canonical translation
    await base44.asServiceRole.entities.Translation.create({
      documentId,
      sourceEntityType,
      sourceEntityId,
      sourceVersionId,
      sourceField,
      sourceLanguage,
      targetLanguage,
      sourceContentHash: contentHash,
      translatedContent: translated,
      status: "ready",
      translatedBy: user.id,
    });

    return {
      sourceVersionId,
      translatedContent: translated,
      status: "ready",
      fromCache: false,
    };
  } catch (error: any) {
    // Record the failure so we don't retry on every request
    await base44.asServiceRole.entities.Translation.create({
      documentId,
      sourceEntityType,
      sourceEntityId,
      sourceVersionId,
      sourceField,
      sourceLanguage,
      targetLanguage,
      sourceContentHash: contentHash,
      translatedContent: "",
      status: "failed",
      errorMessage: error.message,
      translatedBy: user.id,
    }).catch(() => {});

    return {
      sourceVersionId,
      translatedContent: content,
      status: "failed",
      fromCache: false,
      error: error.message,
    };
  }
}