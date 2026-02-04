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
 * Translate HTML content to a target language using LLM
 */
export const translateContent = async (content, targetLanguage) => {
  // DISABLED: Automatic LLM translation creates hallucinations
  throw new Error('Automatic translation is disabled. Please use manual translation or system updates.');
};

/**
 * Get translated content for a DocumentVersion entity
 * Returns cached translation if available, otherwise translates and caches
 */
export const getTranslatedVersionContent = async (version, targetLanguage) => {
  if (!version || !version.content) return null;
  
  const sourceLanguage = version.originalLanguage || detectLanguage(version.content);
  
  // No translation needed if same language
  if (sourceLanguage === targetLanguage) {
    return version.content;
  }
  
  // Check for cached translation
  const cachedTranslation = version.translations?.[targetLanguage];
  if (cachedTranslation) {
    return cachedTranslation;
  }
  
  // Translate and cache
  const translated = await translateContent(version.content, targetLanguage);
  
  // Save translation to cache
  try {
    const newTranslations = {
      ...(version.translations || {}),
      [targetLanguage]: translated
    };
    await base44.entities.DocumentVersion.update(version.id, { 
      translations: newTranslations,
      originalLanguage: sourceLanguage
    });
  } catch (e) {
    console.error('Error caching translation for version:', e);
  }
  
  return translated;
};

/**
 * Get translated content for any entity with translations field
 */
export const getTranslatedContent = async (entity, entityType, targetLanguage, fieldName = 'content') => {
  if (!entity) return null;
  
  const content = entity[fieldName];
  if (!content) return null;
  
  const sourceLanguage = entity.originalLanguage || detectLanguage(content);
  
  // No translation needed if same language
  if (sourceLanguage === targetLanguage) {
    return content;
  }
  
  // Check for cached translation
  const cachedTranslation = entity.translations?.[targetLanguage]?.[fieldName] || entity.translations?.[targetLanguage];
  if (cachedTranslation && typeof cachedTranslation === 'string') {
    return cachedTranslation;
  }
  
  // Translate and cache
  const translated = await translateContent(content, targetLanguage);
  
  // Save translation to cache based on entity type
  try {
    const newTranslations = {
      ...(entity.translations || {}),
      [targetLanguage]: fieldName === 'content' ? translated : {
        ...(entity.translations?.[targetLanguage] || {}),
        [fieldName]: translated
      }
    };
    
    const entityApi = base44.entities[entityType];
    if (entityApi && entity.id) {
      await entityApi.update(entity.id, { 
        translations: newTranslations,
        originalLanguage: sourceLanguage
      });
    }
  } catch (e) {
    console.error(`Error caching translation for ${entityType}:`, e);
  }
  
  return translated;
};