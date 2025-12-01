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
  renderContent = null
}) {
  const { language, isRTL } = useLanguage();
  const queryClient = useQueryClient();

  // זיהוי אוטומטי של שפה אם לא מוגדרת
  const detectedLanguage = entity.originalLanguage || detectLanguage(content || '');
  const originalLanguage = detectedLanguage;
  const translations = entity.translations || {};
  const hasTranslation = translations[language];
  
  // בדיקה אם צריך תרגום - בודק גם אם השפות שונות וגם אם השפה אינה שפת המקור
  const needsTranslation = originalLanguage && language && originalLanguage !== language;
  
  const [showTranslated, setShowTranslated] = useState(needsTranslation && hasTranslation);
  
  const displayLanguage = showTranslated && hasTranslation ? language : originalLanguage;
  const isDisplayRTL = displayLanguage === 'he' || displayLanguage === 'ar';

  const translateMutation = useMutation({
    mutationFn: async () => {
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

      let translatedText;
      if (typeof result === 'string') {
        translatedText = result;
      } else if (result && typeof result === 'object') {
        translatedText = result.content || result.text || result.translation || JSON.stringify(result);
        // If it's still an object after extraction, try to get the first string value
        if (typeof translatedText !== 'string') {
          const values = Object.values(result);
          translatedText = values.find(v => typeof v === 'string') || String(result);
        }
      } else {
        translatedText = String(result || '');
      }
      
      // Clean up any markdown code blocks that might be added
      translatedText = translatedText.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

      const newTranslations = {
        ...translations,
        [language]: translatedText
      };

      await base44.entities[entityType].update(entity.id, {
        translations: newTranslations
      });

      if (onUpdate) {
        onUpdate({ ...entity, translations: newTranslations });
      }

      // Invalidate only the relevant entity queries, not the entire cache
      queryClient.invalidateQueries({ queryKey: [entityType.toLowerCase(), entity.id] });
      setShowTranslated(true);
      return translatedText;
    },
  });

  const displayContent = showTranslated && (translations[language] || translateMutation.isSuccess)
    ? (translations[language] || translateMutation.data)
    : content;

  return (
    <div className="space-y-2">
      {translateMutation.isPending ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="mr-2 text-sm text-slate-600">מתרגם...</span>
        </div>
      ) : (
        <>
          {renderContent ? (
            <div style={{ direction: isDisplayRTL ? 'rtl' : 'ltr', textAlign: isDisplayRTL ? 'right' : 'left' }}>
              {renderContent(displayContent)}
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