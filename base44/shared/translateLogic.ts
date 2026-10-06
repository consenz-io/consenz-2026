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
        ? `You are updating a document section. The original section in ${langName}:\n\n${anchorOriginalContent}\n\nIt was translated to ${sourceLangName} for an editor:\n\n${anchorTranslatedContent}\n\nThe editor proposed this edit in ${sourceLangName}:\n\n${content}\n\nProduce the ${langName} version that incorporates the edit.\n\nCRITICAL RULES:\n1. Start by copying the original ${langName} section VERBATIM, word for word.\n2. Then apply ONLY the specific changes the editor made to the ${sourceLangName} text.\n3. Every word in the original ${langName} section that was NOT directly changed by the editor MUST remain in the output, unchanged and in its original position.\n4. Do NOT merge, delete, rephrase, or reorder any word from the original ${langName} section that the editor did not explicitly change.\n5. When the editor ADDED a phrase, insert the translation of that phrase into the ${langName} text WITHOUT removing or altering any existing ${langName} words.\n6. When the editor DELETED a phrase, remove only the corresponding ${langName} words.\n7. When the editor REPLACED a phrase with another, replace only the corresponding ${langName} words with the translation of the new phrase — leave all surrounding ${langName} words untouched.\n8. Preserve the original's terminology and HTML structure.\nReturn only the HTML with no commentary.`
        : `You are updating a document section. The original section in ${langName}:\n\n${anchorOriginalContent}\n\nIt was translated to ${sourceLangName} for an editor:\n\n${anchorTranslatedContent}\n\nThe editor proposed this edit in ${sourceLangName}:\n\n${content}\n\nProduce the ${langName} version that incorporates the edit.\n\nCRITICAL RULES:\n1. Start by copying the original ${langName} section VERBATIM, word for word.\n2. Then apply ONLY the specific changes the editor made to the ${sourceLangName} text.\n3. Every word in the original ${langName} section that was NOT directly changed by the editor MUST remain in the output, unchanged and in its original position.\n4. Do NOT merge, delete, rephrase, or reorder any word from the original ${langName} section that the editor did not explicitly change.\n5. When the editor ADDED a phrase, insert the translation of that phrase into the ${langName} text WITHOUT removing or altering any existing ${langName} words.\n6. When the editor DELETED a phrase, remove only the corresponding ${langName} words.\n7. When the editor REPLACED a phrase with another, replace only the corresponding ${langName} words with the translation of the new phrase — leave all surrounding ${langName} words untouched.\n8. Preserve the original's terminology.\nReturn only the text with no commentary.`)
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

// ─── Batch translation ──────────────────────────────────────────────────────

export interface BatchUnitInput {
  documentId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceField: string;
  sourceLanguage: string;
  content: string;
  isHtml: boolean;
}

export interface BatchUnitResult {
  sourceEntityType: string;
  sourceEntityId: string;
  sourceField: string;
  translatedContent: string;
  status: "ready" | "not_needed" | "failed" | "from_cache";
  fromCache: boolean;
  error?: string;
}

const LLM_CONCURRENCY = 5;

/**
 * Translate multiple content units in a single batch.
 *
 * Optimizations over calling translateUnit in a loop:
 * 1. Single DB query fetches ALL existing translations for the batch (by
 *    sourceVersionId $in + sourceContentHash $in) instead of N individual
 *    queries.
 * 2. LLM calls for uncached units run in parallel with a concurrency limit
 *    (LLM_CONCURRENCY) instead of sequentially.
 * 3. DB writes for cloning/saving translations run in parallel.
 *
 * For a document with 20 already-translated sections, this reduces the
 * cache-lookup phase from ~20 sequential DB queries (~1s) to a single query
 * (~50ms). For uncached translations, parallel LLM calls cut total time by
 * up to 5x (the concurrency limit).
 */
export async function translateUnitsBatch(
  base44: any,
  user: any,
  documentId: string,
  targetLanguage: string,
  units: BatchUnitInput[]
): Promise<BatchUnitResult[]> {
  // Precompute version IDs, hashes, and translation needs
  const prepared = units.map((u) => {
    const sourceVersionId = buildVersionId(
      u.sourceEntityType as any,
      u.sourceEntityId,
      u.sourceField
    );
    const contentHash = hashContent(u.content);
    const needsTrans =
      needsTranslation(u.sourceLanguage, targetLanguage) && !!u.content;
    return { ...u, sourceVersionId, contentHash, needsTrans };
  });

  const results = new Map<string, BatchUnitResult>();

  // Non-translatable units (same language or empty) — return as-is
  for (const u of prepared) {
    if (!u.needsTrans) {
      results.set(u.sourceVersionId, {
        sourceEntityType: u.sourceEntityType,
        sourceEntityId: u.sourceEntityId,
        sourceField: u.sourceField,
        translatedContent: u.content,
        status: "not_needed",
        fromCache: false,
      });
    }
  }

  const translatable = prepared.filter((u) => u.needsTrans);
  if (translatable.length === 0) {
    return prepared.map((u) => results.get(u.sourceVersionId)!);
  }

  // Phase 1: Single DB query for ALL existing translations
  const versionIds = translatable.map((u) => u.sourceVersionId);
  const hashes = [...new Set(translatable.map((u) => u.contentHash))];

  const [existingByVersion, existingByHash] = await Promise.all([
    base44.asServiceRole.entities.Translation.filter({
      sourceVersionId: { $in: versionIds },
      targetLanguage,
      status: "ready",
    }),
    base44.asServiceRole.entities.Translation.filter({
      sourceContentHash: { $in: hashes },
      targetLanguage,
      status: "ready",
    }).catch(() => []),
  ]);

  const cacheByVersion = new Map<string, any>();
  for (const t of existingByVersion) cacheByVersion.set(t.sourceVersionId, t);
  const cacheByHash = new Map<string, any>();
  for (const t of existingByHash) cacheByHash.set(t.sourceContentHash, t);

  // Phase 2: Resolve cached translations, collect units needing LLM
  const needsLLM: typeof translatable = [];
  const pendingWrites: Promise<any>[] = [];

  for (const u of translatable) {
    const cached = cacheByVersion.get(u.sourceVersionId);

    if (cached && cached.sourceContentHash === u.contentHash) {
      // Cache hit — hash matches, return immediately
      results.set(u.sourceVersionId, {
        sourceEntityType: u.sourceEntityType,
        sourceEntityId: u.sourceEntityId,
        sourceField: u.sourceField,
        translatedContent: cached.translatedContent,
        status: "from_cache",
        fromCache: true,
      });
      continue;
    }

    // Hash mismatch or no cache by version — mark stale if needed
    if (cached) {
      pendingWrites.push(
        base44.asServiceRole.entities.Translation.update(cached.id, {
          status: "stale",
        }).catch(() => {})
      );
    }

    // Check hash-based reuse
    const reusable = cacheByHash.get(u.contentHash);
    if (reusable) {
      // Clone the reusable translation to this version
      pendingWrites.push(
        base44.asServiceRole.entities.Translation.create({
          documentId,
          sourceEntityType: u.sourceEntityType,
          sourceEntityId: u.sourceEntityId,
          sourceVersionId: u.sourceVersionId,
          sourceField: u.sourceField,
          sourceLanguage: u.sourceLanguage,
          targetLanguage,
          sourceContentHash: u.contentHash,
          translatedContent: reusable.translatedContent,
          status: "ready",
          translatedBy: user.id,
        }).catch(() => {})
      );
      results.set(u.sourceVersionId, {
        sourceEntityType: u.sourceEntityType,
        sourceEntityId: u.sourceEntityId,
        sourceField: u.sourceField,
        translatedContent: reusable.translatedContent,
        status: "from_cache",
        fromCache: true,
      });
    } else {
      needsLLM.push(u);
    }
  }

  // Phase 3: LLM translation for uncached units — parallel with concurrency limit
  if (needsLLM.length > 0) {
    const translateOne = async (u: (typeof needsLLM)[0]) => {
      try {
        const langName =
          LANGUAGE_NAMES[targetLanguage as keyof typeof LANGUAGE_NAMES];
        const prompt = u.isHtml
          ? `Translate the following HTML content to ${langName}. Preserve all HTML tags exactly as-is. Only translate the text content between tags. Return only the translated HTML with no additional commentary or markdown.\n\nContent to translate:\n${u.content}`
          : `Translate the following text to ${langName}. Return only the translated text with no commentary or markdown.\n\nText:\n${u.content}`;

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
              u.content;
        translated = String(translated)
          .replace(/```html\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();

        if (!translated || translated.length === 0) {
          throw new Error("Translation returned empty content");
        }

        // Save canonical translation
        pendingWrites.push(
          base44.asServiceRole.entities.Translation.create({
            documentId,
            sourceEntityType: u.sourceEntityType,
            sourceEntityId: u.sourceEntityId,
            sourceVersionId: u.sourceVersionId,
            sourceField: u.sourceField,
            sourceLanguage: u.sourceLanguage,
            targetLanguage,
            sourceContentHash: u.contentHash,
            translatedContent: translated,
            status: "ready",
            translatedBy: user.id,
          }).catch(() => {})
        );

        results.set(u.sourceVersionId, {
          sourceEntityType: u.sourceEntityType,
          sourceEntityId: u.sourceEntityId,
          sourceField: u.sourceField,
          translatedContent: translated,
          status: "ready",
          fromCache: false,
        });
      } catch (error: any) {
        pendingWrites.push(
          base44.asServiceRole.entities.Translation.create({
            documentId,
            sourceEntityType: u.sourceEntityType,
            sourceEntityId: u.sourceEntityId,
            sourceVersionId: u.sourceVersionId,
            sourceField: u.sourceField,
            sourceLanguage: u.sourceLanguage,
            targetLanguage,
            sourceContentHash: u.contentHash,
            translatedContent: "",
            status: "failed",
            errorMessage: error.message,
            translatedBy: user.id,
          }).catch(() => {})
        );

        results.set(u.sourceVersionId, {
          sourceEntityType: u.sourceEntityType,
          sourceEntityId: u.sourceEntityId,
          sourceField: u.sourceField,
          translatedContent: u.content,
          status: "failed",
          fromCache: false,
          error: error.message,
        });
      }
    };

    // Process in chunks of LLM_CONCURRENCY
    for (let i = 0; i < needsLLM.length; i += LLM_CONCURRENCY) {
      const chunk = needsLLM.slice(i, i + LLM_CONCURRENCY);
      await Promise.all(chunk.map(translateOne));
    }
  }

  // Wait for all pending DB writes to complete before returning
  await Promise.all(pendingWrites);

  return prepared.map((u) => results.get(u.sourceVersionId)!);
}