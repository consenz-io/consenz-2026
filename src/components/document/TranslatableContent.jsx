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
  const { language: rawLanguage, isRTL } = useLanguage();
  const language = rawLanguage || 'he';
  const queryClient = useQueryClient();
  const translationContext = useDocumentTranslation();
  const globalShowTranslated = translationContext?.globalShowTranslated || false;

  // CRITICAL: Always call all hooks in the same order, before any early returns or conditional logic
  const [localShowTranslated, setLocalShowTranslated] = useState(false);
  
  // Define translateMutation hook BEFORE any conditional logic
  const translateMutation = useMutation({
    mutationFn: async () => {
      if (!entity || !entityType) {
        throw new Error('Entity is required for translation');
      }
      
      const translations = entity?.translations || {};

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following HTML content to ${languagePrompts[language]}. 
Preserve all HTML tags exactly as-is. Only translate the text content between tags.
Return only the translated HTML with no additional commentary or markdown.

Content to translate:
${content}`,
      });

      let translatedText;
      if (typeof result === 'string') {
        translatedText = result;
      } else if (result && typeof result === 'object') {
        translatedText = result.content || result.text || result.translation || result.output || result.result || result.message || content;
      } else {
        translatedText = content;
      }
      
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

  // Sync with global "Translate All" state only.
  // Individual translations are shown only when the user clicks the translate button
  // or when the global "Translate All" toggle is enabled — never automatically.
  useEffect(() => {
    if (globalShowTranslated) {
      setLocalShowTranslated(true);
    }
  }, [globalShowTranslated]);
  
  // Now safe to calculate derived values after all hooks
  // Prefer createdByLanguage (actual language of suggestion content),
  // then detect from content, then fall back to originalLanguage.
  const detectedLanguage = entity?.createdByLanguage || detectLanguage(content || '') || entity?.originalLanguage;
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

  // Render simple content if no entity - after all hooks have been called
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