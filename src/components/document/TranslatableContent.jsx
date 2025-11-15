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

export default function TranslatableContent({ 
  content, 
  entity, 
  entityType,
  onUpdate,
  className = "",
  renderContent = null
}) {
  const { language, isRTL } = useLanguage();
  const [showTranslated, setShowTranslated] = useState(false);
  const queryClient = useQueryClient();

  const originalLanguage = entity.originalLanguage || 'he';
  const translations = entity.translations || {};
  const hasTranslation = translations[language];
  const needsTranslation = language !== originalLanguage;
  
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

      let translatedText = typeof result === 'string' ? result : result.content || result;
      
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

      queryClient.invalidateQueries();
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
            <div className="flex items-center gap-2 pt-2">
              {!showTranslated && !translateMutation.isPending && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (hasTranslation) {
                      setShowTranslated(true);
                    } else {
                      translateMutation.mutate();
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  <Languages className="w-3 h-3 mr-1" />
                  תרגם ל{languageNames[language]}
                </Button>
              )}
              
              {(showTranslated || translateMutation.isSuccess) && hasTranslation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTranslated(!showTranslated)}
                  className="text-xs text-slate-600 hover:text-slate-700"
                >
                  <Languages className="w-3 h-3 mr-1" />
                  {showTranslated ? `${languageNames[originalLanguage]} (מקור)` : `${languageNames[language]} (מתורגם)`}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}