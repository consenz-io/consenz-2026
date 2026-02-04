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
  // DISABLED: Automatic LLM translation creates hallucinations
  throw new Error('Automatic translation is disabled. Please use manual translation or system updates.');
};

/**
 * Strategy C: Neither text is translated, translate both together
 * This ensures consistency between the two versions
 */
const translatePairTogether = async (originalText, modifiedText, sourceLanguage, targetLanguage) => {
  // DISABLED: Automatic LLM translation creates hallucinations
  throw new Error('Automatic translation is disabled. Please use manual translation or system updates.');
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
  // DISABLED: Automatic LLM translation creates hallucinations
  throw new Error('Automatic translation is disabled. Please use manual translation or system updates.');
};