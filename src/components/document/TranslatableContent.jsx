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
  className = "" 
}) {
  const { language, isRTL } = useLanguage();
  const [showOriginal, setShowOriginal] = useState(false);
  const queryClient = useQueryClient();

  const originalLanguage = entity.originalLanguage || 'he';
  const translations = entity.translations || {};
  const needsTranslation = !showOriginal && language !== originalLanguage && !translations[language];
  
  const displayLanguage = showOriginal ? originalLanguage : language;
  const isDisplayRTL = displayLanguage === 'he' || displayLanguage === 'ar';

  const translateMutation = useMutation({
    mutationFn: async () => {
      const plainText = content.replace(/<[^>]*>/g, '');
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following text to ${languagePrompts[language]}. Return ONLY the translated text, nothing else.

Text to translate:
${plainText}`,
        add_context_from_internet: false,
      });

      const newTranslations = {
        ...translations,
        [language]: result
      };

      await base44.entities[entityType].update(entity.id, {
        translations: newTranslations
      });

      if (onUpdate) {
        onUpdate({ ...entity, translations: newTranslations });
      }

      queryClient.invalidateQueries();
      return result;
    },
  });

  const displayContent = showOriginal 
    ? content 
    : (translations[language] || translateMutation.data || content);

  const isTranslatedView = !showOriginal && (translations[language] || translateMutation.isSuccess);

  return (
    <div className="space-y-2">
      {translateMutation.isPending ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="mr-2 text-sm text-slate-600">מתרגם...</span>
        </div>
      ) : (
        <>
          <div 
            className={className}
            style={{ direction: isDisplayRTL ? 'rtl' : 'ltr', textAlign: isDisplayRTL ? 'right' : 'left' }}
            dangerouslySetInnerHTML={{ __html: displayContent }}
          />
          
          {language !== originalLanguage && (
            <div className="flex items-center gap-2 pt-2">
              {!isTranslatedView && !translateMutation.isPending && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => translateMutation.mutate()}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  <Languages className="w-3 h-3 mr-1" />
                  תרגם ל{languageNames[language]}
                </Button>
              )}
              
              {isTranslatedView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOriginal(!showOriginal)}
                  className="text-xs text-slate-600 hover:text-slate-700"
                >
                  <Languages className="w-3 h-3 mr-1" />
                  {showOriginal ? `${languageNames[language]} (מתורגם)` : `${languageNames[originalLanguage]} (מקור)`}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}