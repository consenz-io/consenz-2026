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
  translated = translated.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
  
  return translated;
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