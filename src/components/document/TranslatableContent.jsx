import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Languages, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

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
  isPlainText = false,
  field = null
}) {
  const { language, isRTL, t } = useLanguage();
  const queryClient = useQueryClient();

  // זיהוי אוטומטי של שפה אם לא מוגדרת
  const detectedLanguage = entity.originalLanguage || detectLanguage(content || '');
  const originalLanguage = detectedLanguage;
  const translations = entity.translations || {};
  const fieldTranslations = field ? translations[language]?.[field] : translations[language];
  const hasTranslation = !!fieldTranslations;
  
  // בדיקה אם צריך תרגום - בודק גם אם השפות שונות וגם אם השפה אינה שפת המקור
  const needsTranslation = originalLanguage && language && originalLanguage !== language;
  
  const [showTranslated, setShowTranslated] = useState(needsTranslation && hasTranslation);
  
  const displayLanguage = showTranslated && hasTranslation ? language : originalLanguage;
  const isDisplayRTL = displayLanguage === 'he' || displayLanguage === 'ar';

  const translateMutation = useMutation({
    mutationFn: async () => {
      const contentType = isPlainText ? 'text' : 'HTML content';
      const prompt = isPlainText 
        ? `You are a professional translator. Translate the following text to ${languagePrompts[language]}.

CRITICAL INSTRUCTIONS:
- Return ONLY the translated text, nothing else
- Do not add any explanations, quotes, or comments
- Do not add "Translation:", "Here is", or any prefix
- Keep the same tone and style
- For titles/headers, maintain capitalization style

Text to translate:
${content}

Return ONLY the translated text:`
        : `You are a professional translator. Translate the following HTML content to ${languagePrompts[language]}.

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

      let translatedText = typeof result === 'string' ? result : result.content || result;
      
      // Advanced cleaning
      translatedText = translatedText
        .replace(/```html\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^(Translation|Here is.*?|Translated.*?):\s*/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();

      const newTranslations = field 
        ? {
            ...translations,
            [language]: {
              ...(translations[language] || {}),
              [field]: translatedText
            }
          }
        : {
            ...translations,
            [language]: translatedText
          };

      await base44.entities[entityType].update(entity.id, {
        translations: newTranslations
      });

      if (onUpdate) {
        onUpdate({ ...entity, translations: newTranslations });
      }

      queryClient.invalidateQueries({ queryKey: [entityType, entity.id] });
      queryClient.invalidateQueries({ queryKey: [entityType + 's'] });
      setShowTranslated(true);
      return translatedText;
    },
    onError: (error) => {
      console.error('Translation error:', error);
    }
  });

  const displayContent = showTranslated && (fieldTranslations || translateMutation.isSuccess)
    ? (fieldTranslations || translateMutation.data)
    : content;

  return (
    <div className="space-y-2">
      {translateMutation.isPending ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className={`text-sm text-slate-600 ${isRTL ? 'mr-2' : 'ml-2'}`}>{t('translating')}</span>
        </div>
      ) : translateMutation.isError ? (
        <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
          {t('translationError') || 'שגיאה בתרגום. נסה שוב.'}
        </div>
      ) : (
        <>
          {renderContent ? (
            <div style={{ direction: isDisplayRTL ? 'rtl' : 'ltr', textAlign: isDisplayRTL ? 'right' : 'left' }}>
              {renderContent(displayContent)}
            </div>
          ) : isPlainText ? (
            <div 
              className={className}
              style={{ direction: isDisplayRTL ? 'rtl' : 'ltr', textAlign: isDisplayRTL ? 'right' : 'left' }}
            >
              {displayContent}
            </div>
          ) : (
            <div 
              className={className}
              style={{ direction: isDisplayRTL ? 'rtl' : 'ltr', textAlign: isDisplayRTL ? 'right' : 'left' }}
              dangerouslySetInnerHTML={{ __html: displayContent }}
            />
          )}
          
          {needsTranslation && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (showTranslated && hasTranslation) {
                    setShowTranslated(false);
                  } else if (hasTranslation) {
                    setShowTranslated(true);
                  } else {
                    translateMutation.mutate();
                  }
                }}
                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                title={showTranslated && hasTranslation ? `${languageNames[originalLanguage]} (מקור)` : `תרגם ל${languageNames[language]}`}
              >
                <Languages className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}