import React, { useEffect, useRef } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { useVersionTranslation } from "./hooks/useVersionTranslation";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { Loader2, Languages, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const languageNames = {
  en: "English",
  he: "עברית",
  ar: "العربية",
};

/**
 * Displays a single DocumentVersion's content with auto-translation.
 *
 * Auto-translates on mount when the viewer's language differs from the
 * content's source language — consistent with SectionDiff's behavior in
 * the diff view. Uses the version-aware `translateVersion` backend function
 * so translations are canonical and shared across all users.
 */
export default function VersionTranslatableContent({ version, documentId }) {
  const { language: rawLanguage } = useLanguage();
  const language = rawLanguage || "he";

  const {
    translatedContent,
    showTranslated,
    isTranslating,
    translateError,
    translate,
    handleToggle,
    needsTranslation,
    sourceLanguage,
  } = useVersionTranslation({
    documentId,
    sourceEntityType: "version",
    sourceEntityId: version?.id,
    sourceField: "content",
    content: version?.content,
    isHtml: true,
    sourceLanguage: version?.originalLanguage,
  });

  // Auto-translate once on mount when needed — matches SectionDiff
  const initiated = useRef(false);
  useEffect(() => {
    if (needsTranslation && !translatedContent && !isTranslating && !initiated.current) {
      initiated.current = true;
      translate();
    }
  }, [needsTranslation, translatedContent, isTranslating, translate]);

  const isValidTranslation =
    translatedContent && translatedContent.length > 1 && translatedContent !== "[object Object]";
  const displayContent = showTranslated && isValidTranslation ? translatedContent : version?.content;
  const displayLanguage = showTranslated && isValidTranslation ? language : sourceLanguage;
  const isContentRTL = displayLanguage === "he" || displayLanguage === "ar";

  return (
    <div
      className="space-y-2"
      dir={isContentRTL ? "rtl" : "ltr"}
      style={{ textAlign: isContentRTL ? "right" : "left" }}
    >
      {isTranslating ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className={`text-sm text-slate-600 ${isContentRTL ? "mr-2" : "ml-2"}`}>
            {rawLanguage === "he" ? "מתרגם..." : rawLanguage === "ar" ? "جارٍ الترجمة..." : "Translating..."}
          </span>
        </div>
      ) : (
        <>
          <div
            className="prose prose-sm max-w-none text-slate-700 p-3 bg-slate-50 rounded-lg"
            style={{
              direction: isContentRTL ? "rtl" : "ltr",
              textAlign: isContentRTL ? "right" : "left",
              fontFamily: "var(--font-document)",
              fontSize: "1rem",
              lineHeight: "1.75",
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayContent) }}
          />
          {needsTranslation && sourceLanguage !== language && (
            <div className={`flex items-center gap-2 pt-1 ${isContentRTL ? "justify-end" : "justify-start"}`}>
              {translateError && !isTranslating && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs gap-1">
                  {rawLanguage === "he" ? "התרגום נכשל" : rawLanguage === "ar" ? "فشل الترجمة" : "Translation failed"}
                </Badge>
              )}
              {isValidTranslation && showTranslated && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs gap-1">
                  <Check className="w-3 h-3" />
                  {languageNames[language]}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggle}
                className={`h-7 px-2 gap-1 ${
                  showTranslated && isValidTranslation
                    ? "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                }`}
                title={
                  showTranslated && isValidTranslation
                    ? `${languageNames[sourceLanguage]} (מקור)`
                    : `תרגם ל${languageNames[language]}`
                }
              >
                <Languages className="w-4 h-4" />
                <span className="text-xs">
                  {showTranslated && isValidTranslation ? languageNames[sourceLanguage] : languageNames[language]}
                </span>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}