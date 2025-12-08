import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Languages, Loader2, Check } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useDocumentTranslation } from "./TranslationContext";

const languageNames = {
  en: "English",
  he: "עברית",
  ar: "العربية"
};

const languagePrompts = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic"
};

const detectLanguage = (text) => {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

export default function TranslatableContent({ 
  content, 
  entity, 
  entityType,
  onUpdate,
  className = "",
  renderContent = null,
  fieldName = null // Optional: specify which field is being translated (e.g., 'explanation', 'newContent')
}) {
  const { language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const translationContext = useDocumentTranslation();
  const globalShowTranslated = translationContext?.globalShowTranslated || false;

  // CRITICAL: Always call all hooks in the same order, before any early returns
  const [localShowTranslated, setLocalShowTranslated] = useState(false);
  
  // Define translateMutation hook BEFORE any conditional logic
  const translateMutation = useMutation({
    mutationFn: async () => {
      if (!entity || !entityType) {
        throw new Error('Entity is required for translation');
      }
      
      const translations = entity?.translations || {};
      
      const prompt = `You are a professional translator. Translate the following HTML content to ${languagePrompts[language]}.

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
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false,
      });

      console.log('[TRANSLATE DEBUG] Raw result:', result);
      console.log('[TRANSLATE DEBUG] Result type:', typeof result);
      console.log('[TRANSLATE DEBUG] Result keys:', result && typeof result === 'object' ? Object.keys(result) : 'N/A');

      let translatedText;
      if (typeof result === 'string') {
        translatedText = result;
      } else if (result && typeof result === 'object') {
        // Try common response structures
        if (typeof result.content === 'string') {
          translatedText = result.content;
        } else if (typeof result.text === 'string') {
          translatedText = result.text;
        } else if (typeof result.translation === 'string') {
          translatedText = result.translation;
        } else if (typeof result.output === 'string') {
          translatedText = result.output;
        } else if (typeof result.result === 'string') {
          translatedText = result.result;
        } else if (typeof result.message === 'string') {
          translatedText = result.message;
        } else {
          // Last resort - find any string value
          const findString = (obj) => {
            for (const key of Object.keys(obj)) {
              if (typeof obj[key] === 'string' && obj[key].length > 0) {
                return obj[key];
              }
              if (obj[key] && typeof obj[key] === 'object') {
                const nested = findString(obj[key]);
                if (nested) return nested;
              }
            }
            return null;
          };
          translatedText = findString(result) || content; // fallback to original content
        }
      } else {
        translatedText = content; // fallback to original content
      }
      
      console.log('[TRANSLATE DEBUG] Final translatedText:', translatedText);
      
      // Clean up any markdown code blocks that might be added
      translatedText = translatedText.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

      // Store translation with field name if provided
      let newTranslations;
      if (fieldName) {
        const existingLangTranslation = translations[language] || {};
        const langObj = typeof existingLangTranslation === 'string' 
          ? { content: existingLangTranslation } 
          : { ...existingLangTranslation };
        langObj[fieldName] = translatedText;
        newTranslations = {
          ...translations,
          [language]: langObj
        };
      } else {
        newTranslations = {
          ...translations,
          [language]: translatedText
        };
      }

      await base44.entities[entityType].update(entity.id, {
        translations: newTranslations
      });

      if (onUpdate) {
        onUpdate({ ...entity, translations: newTranslations });
      }

      // Invalidate only the relevant entity queries, not the entire cache
      queryClient.invalidateQueries({ queryKey: [entityType.toLowerCase(), entity.id] });
      setLocalShowTranslated(true);
      return translatedText;
    },
  });
  
  // זיהוי אוטומטי של שפה אם לא מוגדרת
  const detectedLanguage = entity?.originalLanguage || detectLanguage(content || '');
  const originalLanguage = detectedLanguage;
  const translations = entity?.translations || {};
  
  // Get translation for specific field if fieldName is provided
  const getFieldTranslation = () => {
    const langTranslation = translations[language];
    if (!langTranslation) return null;
    
    // If it's a string, it's the main content translation
    if (typeof langTranslation === 'string') {
      return fieldName ? null : langTranslation;
    }
    
    // If it's an object with field-specific translations
    if (typeof langTranslation === 'object') {
      // If fieldName is specified, only return that specific field's translation
      if (fieldName) {
        if (typeof langTranslation[fieldName] === 'string') {
          return langTranslation[fieldName];
        }
        return null; // Don't fall back to other fields when fieldName is specified
      }
      // For backwards compatibility - if no fieldName, try common fields (content first, then newContent)
      if (typeof langTranslation.content === 'string') return langTranslation.content;
      if (typeof langTranslation.newContent === 'string') return langTranslation.newContent;
    }
    return null;
  };
  
  const hasTranslation = getFieldTranslation() !== null;
  
  // בדיקה אם צריך תרגום - בודק גם אם השפות שונות וגם אם השפה אינה שפת המקור
  const needsTranslation = originalLanguage && language && originalLanguage !== language;
  
  // Sync with global translation state and initial state
  useEffect(() => {
    if (hasTranslation) {
      setLocalShowTranslated(globalShowTranslated || (needsTranslation && hasTranslation));
    }
  }, [globalShowTranslated, hasTranslation, needsTranslation]);
  
  const showTranslated = localShowTranslated;
  
  // קביעת כיוון הטקסט - תמיד לפי שפת המערכת (isRTL)
  // כי המשתמש בחר את השפה הזו והוא מצפה שהממשק יתאים לה
  const isDisplayRTL = isRTL;

  // Helper to ensure we get a valid string for display
  const ensureString = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      // Check if it's a character-indexed object (corrupted string like {'0': 'a', '1': 'b'...})
      const keys = Object.keys(val);
      if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
        // Reconstruct string from indexed characters
        const maxIndex = Math.max(...keys.map(k => parseInt(k)));
        let reconstructed = '';
        for (let i = 0; i <= maxIndex; i++) {
          reconstructed += val[i.toString()] || '';
        }
        if (reconstructed.length > 0) {
          return reconstructed;
        }
      }
      
      // Try common response fields for LLM responses
      const fields = ['content', 'text', 'translation', 'output', 'result', 'message', 'newContent'];
      for (const field of fields) {
        if (typeof val[field] === 'string' && val[field].length > 0) {
          return val[field];
        }
      }
    }
    return null;
  };

  const translatedValue = getFieldTranslation() || translateMutation.data;
  const safeTranslation = ensureString(translatedValue);
  
  // Only show translation if it's valid
  const isValidTranslation = safeTranslation && 
    safeTranslation.length > 1 && 
    safeTranslation !== '[object Object]';
  
  const displayContent = showTranslated && isValidTranslation
    ? safeTranslation
    : content;

  // Render simple content if no entity
  if (!entity) {
    return renderContent ? renderContent(content) : (
      <div className={className} dangerouslySetInnerHTML={{ __html: content }} />
    );
  }

  return (
    <div className="space-y-2" dir={isRTL ? 'rtl' : 'ltr'} style={{ textAlign: isRTL ? 'right' : 'left' }}>
      {translateMutation.isPending ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className={`text-sm text-slate-600 ${isRTL ? 'mr-2' : 'ml-2'}`}>
            {isRTL ? 'מתרגם...' : 'Translating...'}
          </span>
        </div>
      ) : (
        <>
          {renderContent ? (
            <div>
              {renderContent(displayContent)}
            </div>
          ) : (
            <div 
              className={className}
              dangerouslySetInnerHTML={{ __html: displayContent }}
            />
          )}
          
          {needsTranslation && originalLanguage !== language && (
            <div className={`flex items-center gap-2 pt-1 ${isRTL ? 'justify-end' : 'justify-start'}`}>
              {hasTranslation && showTranslated && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs gap-1">
                  <Check className="w-3 h-3" />
                  {languageNames[language]}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (showTranslated && hasTranslation) {
                    setLocalShowTranslated(false);
                  } else if (hasTranslation) {
                    setLocalShowTranslated(true);
                  } else {
                    translateMutation.mutate();
                  }
                }}
                className={`h-7 px-2 gap-1 ${showTranslated && hasTranslation 
                  ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-50' 
                  : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'}`}
                title={showTranslated && hasTranslation ? `${languageNames[originalLanguage]} (מקור)` : `תרגם ל${languageNames[language]}`}
              >
                <Languages className="w-4 h-4" />
                <span className="text-xs">
                  {showTranslated && hasTranslation ? languageNames[originalLanguage] : languageNames[language]}
                </span>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}