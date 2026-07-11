import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";

const languageNames = { en: "English", he: "עברית", ar: "العربية" };
const languagePrompts = { en: "English", he: "Hebrew", ar: "Arabic" };

const detectLanguage = (text) => {
  if (!text) return 'he';
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
};

/**
 * Lightweight translatable text - does NOT persist translation to DB.
 * Used for entity names/descriptions that lack a translations field.
 * Props:
 *   text        - the string to display
 *   isHtml      - if true, renders with dangerouslySetInnerHTML
 *   className   - css class for the text element
 *   buttonClass - extra css class for the translate button
 */
export default function TranslatableText({ text, isHtml = false, className = "", buttonClass = "" }) {
  const { language, isRTL } = useLanguage();
  const [translated, setTranslated] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);

  const detectedLang = detectLanguage(text);
  const needsTranslation = detectedLang !== language;

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following text to ${languagePrompts[language]}. Return only the translated text with no commentary or markdown.\n\nText:\n${text}`,
      });
      let out = typeof result === 'string' ? result : (result?.content || result?.text || result?.translation || text);
      out = out.replace(/```[\w]*\n?/g, '').replace(/```\n?/g, '').trim();
      return out;
    },
    onSuccess: (data) => {
      setTranslated(data);
      setShowTranslated(true);
    },
  });

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (showTranslated) {
      setShowTranslated(false);
    } else if (translated) {
      setShowTranslated(true);
    } else {
      mutation.mutate();
    }
  };

  const displayText = showTranslated && translated ? translated : text;

  return (
    <span className="inline-flex flex-col gap-0.5">
      {mutation.isPending ? (
        <span className="flex items-center gap-1 text-slate-500 text-sm">
          <Loader2 className="w-3 h-3 animate-spin" />
          {language === 'he' ? 'מתרגם...' : language === 'ar' ? 'جارٍ الترجمة...' : 'Translating...'}
        </span>
      ) : isHtml ? (
        <span className={className} dangerouslySetInnerHTML={{ __html: displayText }} />
      ) : (
        <span className={className}>{displayText}</span>
      )}

      {needsTranslation && !mutation.isPending && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          className={`h-6 px-1.5 gap-1 w-fit ${showTranslated ? 'text-slate-400 hover:text-slate-600' : 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'} ${buttonClass}`}
          title={showTranslated ? `${languageNames[detectedLang]} (מקור)` : `תרגם ל${languageNames[language]}`}
        >
          <Languages className="w-3 h-3" />
          <span className="text-xs">{showTranslated ? languageNames[detectedLang] : languageNames[language]}</span>
        </Button>
      )}
    </span>
  );
}