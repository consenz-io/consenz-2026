import { base44 } from "@/api/base44Client";

/**
 * זיהוי אוטומטי של שפת הטקסט
 */
export const detectLanguage = (text) => {
  if (!text || typeof text !== 'string') return 'he';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

const languagePrompts = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic"
};

/**
 * תרגום תוכן באמצעות LLM
 * @param {string} content - התוכן לתרגום
 * @param {string} targetLanguage - שפת היעד
 * @param {boolean} isHtml - האם התוכן הוא HTML
 * @returns {Promise<string>} התוכן המתורגם
 */
export async function translateContent(content, targetLanguage, isHtml = true) {
  if (!content || !targetLanguage) return content;
  
  const targetLangName = languagePrompts[targetLanguage] || targetLanguage;
  
  let prompt;
  if (isHtml) {
    prompt = `You are a professional translator. Translate the following HTML content to ${targetLangName}.

CRITICAL INSTRUCTIONS:
- Keep ALL HTML tags exactly as they are (including <p>, <strong>, <em>, <ul>, <li>, etc.)
- Only translate the TEXT CONTENT between the tags
- Return ONLY the translated HTML, nothing else
- Do not add any explanations or comments
- Do not escape HTML characters
- Maintain exact same structure and formatting

HTML content to translate:
${content}

Return ONLY the translated HTML:`;
  } else {
    prompt = `Translate the following text to ${targetLangName}. Return ONLY the translated text, nothing else:

${content}`;
  }

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: prompt,
    add_context_from_internet: false,
  });

  let translatedContent = typeof result === 'string' ? result : result.content || result;
  
  // Clean up any markdown code blocks that might be added
  translatedContent = translatedContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

  return translatedContent;
}

/**
 * קבלת תוכן מתורגם עבור ישות - עם קאשינג
 * @param {Object} entity - הישות (Section, DocumentVersion, Suggestion וכו')
 * @param {string} entityType - סוג הישות ("Section", "DocumentVersion", "Suggestion")
 * @param {string} content - התוכן המקורי
 * @param {string} targetLanguage - שפת היעד
 * @param {string} fieldName - שם השדה (אופציונלי, לדוגמה "content", "newContent", "explanation")
 * @returns {Promise<string>} התוכן המתורגם
 */
export async function getTranslatedContent(entity, entityType, content, targetLanguage, fieldName = 'content') {
  if (!entity || !content || !targetLanguage) return content;
  
  // זיהוי שפת המקור
  const originalLanguage = entity.originalLanguage || detectLanguage(content);
  
  // אם השפה זהה, החזר את התוכן המקורי
  if (originalLanguage === targetLanguage) {
    return content;
  }
  
  // בדיקה אם יש תרגום שמור
  const translations = entity.translations || {};
  const cachedTranslation = translations[targetLanguage];
  
  if (cachedTranslation) {
    // אם זה מחרוזת ישירה
    if (typeof cachedTranslation === 'string') {
      return cachedTranslation;
    }
    // אם זה אובייקט עם שדות
    if (typeof cachedTranslation === 'object' && cachedTranslation[fieldName]) {
      return cachedTranslation[fieldName];
    }
  }
  
  // אין תרגום שמור - מבצעים תרגום
  const isHtml = content.includes('<') && content.includes('>');
  const translatedContent = await translateContent(content, targetLanguage, isHtml);
  
  // שמירת התרגום בקאש
  try {
    let newTranslations;
    if (fieldName === 'content') {
      newTranslations = {
        ...translations,
        [targetLanguage]: translatedContent
      };
    } else {
      const existingLangTranslation = translations[targetLanguage] || {};
      const langObj = typeof existingLangTranslation === 'string' 
        ? { content: existingLangTranslation } 
        : { ...existingLangTranslation };
      langObj[fieldName] = translatedContent;
      newTranslations = {
        ...translations,
        [targetLanguage]: langObj
      };
    }
    
    await base44.entities[entityType].update(entity.id, {
      translations: newTranslations
    });
  } catch (e) {
    console.error(`Error saving translation to ${entityType}:`, e);
  }
  
  return translatedContent;
}

/**
 * תרגום שני תכנים במקביל לשפה משותפת (לצורך השוואת diff)
 * @param {Object} params - פרמטרים
 * @param {string} params.originalContent - התוכן המקורי
 * @param {string} params.newContent - התוכן החדש
 * @param {Object} params.originalEntity - הישות של התוכן המקורי (אופציונלי)
 * @param {Object} params.newEntity - הישות של התוכן החדש (אופציונלי)
 * @param {string} params.originalEntityType - סוג ישות המקור
 * @param {string} params.newEntityType - סוג ישות החדש
 * @param {string} params.targetLanguage - שפת היעד
 * @returns {Promise<{translatedOriginal: string, translatedNew: string}>}
 */
export async function translateForDiff({
  originalContent,
  newContent,
  originalEntity,
  newEntity,
  originalEntityType = 'DocumentVersion',
  newEntityType = 'Suggestion',
  targetLanguage
}) {
  if (!targetLanguage) {
    return { translatedOriginal: originalContent, translatedNew: newContent };
  }
  
  const originalLang = originalEntity?.originalLanguage || detectLanguage(originalContent);
  const newLang = newEntity?.originalLanguage || detectLanguage(newContent);
  
  // תרגום במקביל
  const [translatedOriginal, translatedNew] = await Promise.all([
    originalLang !== targetLanguage && originalEntity
      ? getTranslatedContent(originalEntity, originalEntityType, originalContent, targetLanguage)
      : originalContent,
    newLang !== targetLanguage && newEntity
      ? getTranslatedContent(newEntity, newEntityType, newContent, targetLanguage)
      : newContent
  ]);
  
  return { translatedOriginal, translatedNew };
}