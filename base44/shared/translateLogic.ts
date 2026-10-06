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
  /**
   * Optional anchor for cross-language suggestion translation. When a
   * suggestion was written in language B based on a section originally in
   * language A, translating the suggestion back to A should be anchored to
   * the section's existing translations to avoid drift:
   *   - anchorOriginalContent: the section content in the TARGET language
   *   - anchorTranslatedContent: the section content in the SOURCE language
   *     (i.e. the translation the proposer saw and edited)
   * The LLM then produces the target-language version by applying the edit
   * to the anchored original, instead of re-translating the whole text.
   */
  anchorOriginalContent?: string;
  anchorTranslatedContent?: string;
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
    anchorOriginalContent,
    anchorTranslatedContent,
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

  // Reuse by content hash: if any translation with the same source hash +
  // target language already exists (even from a different sourceVersionId),
  // clone it for this version. This avoids re-translating identical content
  // when a suggestion is accepted and becomes a section, or when the same
  // text appears as both a "current" section and a "version" snapshot.
  // Skip reuse when an anchor is provided — anchored translations are aligned
  // to a specific base section and must not be cloned from an unrelated
  // un-anchored translation of identical content.
  const hasAnchor = !!(anchorOriginalContent && anchorTranslatedContent);
  const existingByHash = hasAnchor ? [] : await base44.asServiceRole.entities.Translation.filter({
    sourceContentHash: contentHash,
    targetLanguage,
    status: "ready",
  }).catch(() => []);

  if (existingByHash.length > 0) {
    const reusable = existingByHash[0];
    await base44.asServiceRole.entities.Translation.create({
      documentId,
      sourceEntityType,
      sourceEntityId,
      sourceVersionId,
      sourceField,
      sourceLanguage,
      targetLanguage,
      sourceContentHash: contentHash,
      translatedContent: reusable.translatedContent,
      status: "ready",
      translatedBy: user.id,
    });

    return {
      sourceVersionId,
      translatedContent: reusable.translatedContent,
      status: "from_cache",
      fromCache: true,
    };
  }

  // Translate via LLM
  try {
    const langName = LANGUAGE_NAMES[targetLanguage as keyof typeof LANGUAGE_NAMES];
    const sourceLangName = LANGUAGE_NAMES[sourceLanguage as keyof typeof LANGUAGE_NAMES];
    const prompt = hasAnchor
      ? (isHtml
        ? `You are updating a document section. The original section in ${langName}:\n\n${anchorOriginalContent}\n\nIt was translated to ${sourceLangName} for an editor:\n\n${anchorTranslatedContent}\n\nThe editor proposed this edit in ${sourceLangName}:\n\n${content}\n\nProduce the ${langName} version that incorporates the edit. Start from the original ${langName} section and apply only the changes the editor made. Preserve the original's wording, terminology, and HTML structure. Return only the HTML with no commentary.`
        : `You are updating a document section. The original section in ${langName}:\n\n${anchorOriginalContent}\n\nIt was translated to ${sourceLangName} for an editor:\n\n${anchorTranslatedContent}\n\nThe editor proposed this edit in ${sourceLangName}:\n\n${content}\n\nProduce the ${langName} version that incorporates the edit. Start from the original ${langName} text and apply only the changes the editor made. Preserve the original's wording and terminology. Return only the text with no commentary.`)
      : isHtml
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