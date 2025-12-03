import { base44 } from "@/api/base44Client";

const languageNames = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic"
};

/**
 * Detect the language of a given text
 */
export const detectLanguage = (text) => {
  if (!text) return 'en';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

/**
 * Strategy A: Both texts already have cached translations
 * Simply return the cached translations
 */
const getFromCache = (originalEntity, newEntity, targetLanguage, originalFieldName = 'content', newFieldName = 'newContent') => {
  const cachedOriginal = getCachedTranslation(originalEntity, targetLanguage, originalFieldName);
  const cachedNew = getCachedTranslation(newEntity, targetLanguage, newFieldName);
  
  if (cachedOriginal && cachedNew) {
    return {
      original: cachedOriginal,
      modified: cachedNew,
      fromCache: { original: true, modified: true }
    };
  }
  
  return { cachedOriginal, cachedNew };
};

/**
 * Get cached translation from entity
 */
const getCachedTranslation = (entity, targetLanguage, fieldName = 'content') => {
  if (!entity) return null;
  
  const translations = entity.translations;
  if (!translations) return null;
  
  // Handle nested field translations (e.g., translations.en.newContent)
  if (translations[targetLanguage]) {
    const langTranslations = translations[targetLanguage];
    if (typeof langTranslations === 'string') {
      return langTranslations;
    }
    if (langTranslations[fieldName]) {
      return langTranslations[fieldName];
    }
  }
  
  return null;
};

/**
 * Strategy B: One text is translated, translate the other with reference
 * This ensures consistency by using the existing translation as reference
 */
const translateWithReference = async (
  textToTranslate,
  referenceOriginal,
  referenceTranslation,
  sourceLanguage,
  targetLanguage
) => {
  const prompt = `You are a professional translator specializing in maintaining consistency.

CONTEXT:
- Original text (${languageNames[sourceLanguage]}): "${referenceOriginal}"
- Its translation to ${languageNames[targetLanguage]}: "${referenceTranslation}"

TASK:
Translate the following text (which is a modified version of the original) to ${languageNames[targetLanguage]}.

CRITICAL INSTRUCTIONS:
1. MAINTAIN CONSISTENCY: For parts that are identical to the original, use EXACTLY the same translation as provided
2. Only translate the CHANGED parts differently
3. Keep ALL HTML tags exactly as they are
4. Return ONLY the translated HTML, nothing else

Text to translate:
${textToTranslate}

Return ONLY the translated text:`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: false,
  });

  let translated = typeof result === 'string' ? result : result.content || result;
  translated = translated.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
  
  return translated;
};

/**
 * Strategy C: Neither text is translated, translate both together
 * This ensures consistency between the two versions
 */
const translatePairTogether = async (originalText, modifiedText, sourceLanguage, targetLanguage) => {
  const prompt = `You are a professional translator. Translate TWO versions of the same document to ${languageNames[targetLanguage]}.

CRITICAL INSTRUCTIONS:
1. Both texts are versions of the SAME document
2. Use IDENTICAL translations for parts that are the same in both versions
3. Only the ACTUAL CHANGES should have different translations
4. Keep ALL HTML tags exactly as they are
5. Return a JSON object with "original" and "modified" keys

Original version (${languageNames[sourceLanguage]}):
${originalText}

Modified version (${languageNames[sourceLanguage]}):
${modifiedText}

Return ONLY valid JSON in this format:
{
  "original": "<translated original>",
  "modified": "<translated modified>"
}`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: false,
    response_json_schema: {
      type: "object",
      properties: {
        original: { type: "string" },
        modified: { type: "string" }
      },
      required: ["original", "modified"]
    }
  });

  // Handle both string and object responses
  if (typeof result === 'object' && result.original && result.modified) {
    return {
      original: cleanHtml(result.original),
      modified: cleanHtml(result.modified)
    };
  }

  // Try parsing as JSON string
  try {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    return {
      original: cleanHtml(parsed.original),
      modified: cleanHtml(parsed.modified)
    };
  } catch (e) {
    console.error('Failed to parse translation pair response:', e);
    throw new Error('Translation failed - invalid response format');
  }
};

const cleanHtml = (text) => {
  if (!text) return text;
  return text.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
};

/**
 * Save translation to entity cache
 */
const saveTranslationToCache = async (entity, entityType, translation, targetLanguage, fieldName = 'content') => {
  if (!entity?.id) return;
  
  try {
    const currentTranslations = entity.translations || {};
    let newTranslations;
    
    if (fieldName === 'content') {
      newTranslations = {
        ...currentTranslations,
        [targetLanguage]: translation
      };
    } else {
      newTranslations = {
        ...currentTranslations,
        [targetLanguage]: {
          ...(currentTranslations[targetLanguage] || {}),
          [fieldName]: translation
        }
      };
    }
    
    const entityApi = base44.entities[entityType];
    if (entityApi) {
      await entityApi.update(entity.id, { translations: newTranslations });
    }
  } catch (e) {
    console.error(`Error caching translation for ${entityType}:`, e);
  }
};

/**
 * Main function: Get diff content in target language
 * 
 * @param {Object} params
 * @param {string} params.originalContent - Original content
 * @param {string} params.modifiedContent - Modified/new content
 * @param {Object} params.originalEntity - Entity containing original (Section/DocumentVersion)
 * @param {string} params.originalEntityType - 'Section' or 'DocumentVersion'
 * @param {Object} params.modifiedEntity - Entity containing modified (Suggestion/DocumentVersion)
 * @param {string} params.modifiedEntityType - 'Suggestion' or 'DocumentVersion'
 * @param {string} params.targetLanguage - Language to translate to
 * @param {string} params.originalFieldName - Field name in original entity (default: 'content')
 * @param {string} params.modifiedFieldName - Field name in modified entity (default: 'newContent' or 'content')
 */
export const getDiffInLanguage = async ({
  originalContent,
  modifiedContent,
  originalEntity,
  originalEntityType,
  modifiedEntity,
  modifiedEntityType,
  targetLanguage,
  originalFieldName = 'content',
  modifiedFieldName = 'newContent'
}) => {
  // Determine source languages
  const originalSourceLang = originalEntity?.originalLanguage || detectLanguage(originalContent);
  const modifiedSourceLang = modifiedEntity?.originalLanguage || detectLanguage(modifiedContent);
  
  // Check if translation is needed
  const originalNeedsTranslation = originalSourceLang !== targetLanguage;
  const modifiedNeedsTranslation = modifiedSourceLang !== targetLanguage;
  
  // If neither needs translation, return as-is
  if (!originalNeedsTranslation && !modifiedNeedsTranslation) {
    return {
      original: originalContent,
      modified: modifiedContent,
      fromCache: { original: false, modified: false },
      strategy: 'none',
      sourceLanguages: { original: originalSourceLang, modified: modifiedSourceLang }
    };
  }
  
  // Strategy A: Check if both are in cache
  const cachedOriginal = originalNeedsTranslation 
    ? getCachedTranslation(originalEntity, targetLanguage, originalFieldName)
    : originalContent;
  const cachedModified = modifiedNeedsTranslation
    ? getCachedTranslation(modifiedEntity, targetLanguage, modifiedFieldName)
    : modifiedContent;
  
  if (cachedOriginal && cachedModified) {
    return {
      original: cachedOriginal,
      modified: cachedModified,
      fromCache: { original: originalNeedsTranslation, modified: modifiedNeedsTranslation },
      strategy: 'A',
      sourceLanguages: { original: originalSourceLang, modified: modifiedSourceLang }
    };
  }
  
  // Strategy B: One is cached, translate the other with reference
  if (cachedOriginal && !cachedModified) {
    const translatedModified = await translateWithReference(
      modifiedContent,
      originalContent,
      cachedOriginal,
      modifiedSourceLang,
      targetLanguage
    );
    
    // Cache the new translation
    await saveTranslationToCache(
      modifiedEntity,
      modifiedEntityType,
      translatedModified,
      targetLanguage,
      modifiedFieldName
    );
    
    return {
      original: cachedOriginal,
      modified: translatedModified,
      fromCache: { original: true, modified: false },
      strategy: 'B-original',
      sourceLanguages: { original: originalSourceLang, modified: modifiedSourceLang }
    };
  }
  
  if (!cachedOriginal && cachedModified) {
    const translatedOriginal = await translateWithReference(
      originalContent,
      modifiedContent,
      cachedModified,
      originalSourceLang,
      targetLanguage
    );
    
    // Cache the new translation
    await saveTranslationToCache(
      originalEntity,
      originalEntityType,
      translatedOriginal,
      targetLanguage,
      originalFieldName
    );
    
    return {
      original: translatedOriginal,
      modified: cachedModified,
      fromCache: { original: false, modified: true },
      strategy: 'B-modified',
      sourceLanguages: { original: originalSourceLang, modified: modifiedSourceLang }
    };
  }
  
  // Strategy C: Neither is cached, translate both together
  const translated = await translatePairTogether(
    originalContent,
    modifiedContent,
    originalSourceLang, // Use the original's source language as primary
    targetLanguage
  );
  
  // Cache both translations
  await Promise.all([
    saveTranslationToCache(
      originalEntity,
      originalEntityType,
      translated.original,
      targetLanguage,
      originalFieldName
    ),
    saveTranslationToCache(
      modifiedEntity,
      modifiedEntityType,
      translated.modified,
      targetLanguage,
      modifiedFieldName
    )
  ]);
  
  return {
    original: translated.original,
    modified: translated.modified,
    fromCache: { original: false, modified: false },
    strategy: 'C',
    sourceLanguages: { original: originalSourceLang, modified: modifiedSourceLang }
  };
};

/**
 * Translate a single content piece (for non-diff scenarios)
 */
export const translateContent = async (content, targetLanguage) => {
  if (!content || !targetLanguage) return content;
  
  const prompt = `You are a professional translator. Translate the following HTML content to ${languageNames[targetLanguage]}.

CRITICAL INSTRUCTIONS:
- Keep ALL HTML tags exactly as they are
- Only translate the TEXT CONTENT between the tags
- Return ONLY the translated HTML, nothing else
- Do not add any explanations or comments
- Maintain exact same structure and formatting

HTML content to translate:
${content}

Return ONLY the translated HTML:`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: prompt,
    add_context_from_internet: false,
  });

  let translated = typeof result === 'string' ? result : result.content || result;
  translated = cleanHtml(translated);
  
  return translated;
};