import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Languages, Loader2, Check } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useDocumentTranslation } from "./TranslationContext";
import { useVersionTranslation } from "./hooks/useVersionTranslation";
import TranslatablePreview from "./TranslatablePreview";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

const languageNames = {
  en: "English",
  he: "עברית",
  ar: "العربية"
};

const detectLanguage = (text) => {
  if (!text) return 'en';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

/** Map the legacy entityType prop to the backend's sourceEntityType. */
const mapEntityType = (entityType) => {
  if (!entityType) return 'section';
  const lower = entityType.toLowerCase();
  if (lower === 'documentversion') return 'version';
  return lower;
};

/**
 * TranslatableContent — displays content in the selected language and lets
 * users translate it on demand.
 *
 * Uses the version-aware `translateVersion` backend function via the
 * `useVersionTranslation` hook. Translations are canonical and shared across
 * all users — two users viewing the same version in the same language see the
 * same translation.
 *
 * Props:
 * - content:         The source text (plain or HTML)
 * - documentId:       Parent document ID (required for translation)
 * - entity:           Source entity (used for source-language detection only)
 * - entityType:      Legacy entity type (Section, Suggestion, DocumentVersion, Comment, ...)
 * - sourceEntityType: Override for entityType (section, version, suggestion, ...)
 * - sourceField:      Which field is being translated (default: 'content' or fieldName)
 * - isHtml:           Whether content is HTML (default: true)
 * - fieldName:        Legacy prop — maps to sourceField
 * - className, renderContent, preview: Display options
 */
export default function TranslatableContent({
  content,
  entity,
  entityType,
  documentId,
  sourceEntityType: explicitSourceType,
  sourceEntityId: explicitSourceId,
  sourceField: explicitSourceField,
  isHtml,
  fieldName,
  className = "",
  renderContent = null,
  preview = false,
}) {
  const { language: rawLanguage, isRTL } = useLanguage();
  const language = rawLanguage || 'he';
  const translationContext = useDocumentTranslation();
  const globalShowTranslated = translationContext?.globalShowTranslated || false;

  // Derive parameters for the version translation hook
  const resolvedSourceType = explicitSourceType || mapEntityType(entityType);
  const resolvedEntityId = explicitSourceId || entity?.id;
  const resolvedSourceField = explicitSourceField || fieldName || 'content';
  const resolvedIsHtml = isHtml !== undefined ? isHtml : true;
  const resolvedSourceLanguage = entity?.createdByLanguage || entity?.originalLanguage || detectLanguage(content || '');

  const {
    translatedContent,
    showTranslated: localShowTranslated,
    isTranslating,
    translateError,
    handleToggle,
    needsTranslation,
  } = useVersionTranslation({
    documentId,
    sourceEntityType: resolvedSourceType,
    sourceEntityId: resolvedEntityId,
    sourceField: resolvedSourceField,
    content,
    isHtml: resolvedIsHtml,
    sourceLanguage: resolvedSourceLanguage,
    globalShowTranslated,
  });

  const showTranslated = localShowTranslated || (globalShowTranslated && !!translatedContent);
  const hasTranslation = !!translatedContent;
  const isValidTranslation = translatedContent &&
    translatedContent.length > 1 &&
    translatedContent !== '[object Object]';

  const displayContent = showTranslated && isValidTranslation
    ? translatedContent
    : content;

  // Direction follows the DISPLAYED content's language, not the UI language.
  // When showing translated content → target language direction.
  // When showing original → source language direction.
  const displayLanguage = showTranslated && isValidTranslation
    ? language
    : resolvedSourceLanguage;
  const isContentRTL = displayLanguage === 'he' || displayLanguage === 'ar';

  // Fallback: render plain content when no entity or no documentId
  if (!entity || !documentId) {
    return renderContent ? renderContent(content) : (
      <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
    );
  }

  return (
    <div className="space-y-2" dir={isContentRTL ? 'rtl' : 'ltr'} style={{ textAlign: isContentRTL ? 'right' : 'left' }}>
      {isTranslating ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className={`text-sm text-slate-600 ${isContentRTL ? 'mr-2' : 'ml-2'}`}>
            {rawLanguage === 'he' ? 'מתרגם...' : rawLanguage === 'ar' ? 'جارٍ الترجمة...' : 'Translating...'}
          </span>
        </div>
      ) : (
        <>
          {renderContent ? (
            <div>
              {renderContent(displayContent)}
            </div>
          ) : preview ? (
            <TranslatablePreview
              content={displayContent}
              className={className}
              isRTL={isRTL}
              language={language}
            />
          ) : (
            <div
              className={className}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayContent) }}
            />
          )}

          {needsTranslation && resolvedSourceLanguage !== language && (
            <div className={`flex items-center gap-2 pt-1 ${isContentRTL ? 'justify-end' : 'justify-start'}`}>
              {translateError && !isTranslating && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs gap-1">
                  {rawLanguage === 'he' ? 'התרגום נכשל' : rawLanguage === 'ar' ? 'فشل الترجمة' : 'Translation failed'}
                </Badge>
              )}
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
                  handleToggle();
                }}
                className={`h-7 px-2 gap-1 ${showTranslated && hasTranslation
                  ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'}`}
                title={showTranslated && hasTranslation ? `${languageNames[resolvedSourceLanguage]} (מקור)` : `תרגם ל${languageNames[language]}`}
              >
                <Languages className="w-4 h-4" />
                <span className="text-xs">
                  {showTranslated && hasTranslation ? languageNames[resolvedSourceLanguage] : languageNames[language]}
                </span>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}