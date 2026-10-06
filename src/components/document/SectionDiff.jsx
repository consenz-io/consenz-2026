import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Languages, Loader2, Eye, FileText, Check, Info } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
const detectLanguage = (text) => {
  if (!text) return 'en';
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
};
import DiffModeSelector, { DIFF_MODES, useDiffMode } from "./DiffModeSelector";
import ChangeBlockDiffView from "./ChangeBlockDiffView";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

const languageLabels = {
  en: "English",
  he: "עברית",
  ar: "العربية"
};

export default function SectionDiff({ 
  originalContent, 
  newContent, 
  documentId, 
  sectionId, 
  suggestion,
  originalVersion,
  newVersion,
  section // Pass the section entity for cache
}) {
  const { t, language: rawLanguage, isRTL } = useLanguage();
  const language = rawLanguage || 'he';
  const [translationResult, setTranslationResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const [diffMode, setDiffMode] = useDiffMode();
  
  // Reset state when suggestion changes
  useEffect(() => {
    setTranslationResult(null);
    setShowTranslated(false);
    setIsTranslating(false);
  }, [suggestion?.id, sectionId, originalContent, newContent]);
  
  // Detect source languages
  const originalSourceLang = originalVersion?.originalLanguage || 
                              section?.originalLanguage || 
                              detectLanguage(originalContent || '');
  const modifiedSourceLang = newVersion?.originalLanguage || 
                              suggestion?.createdByLanguage ||
                              suggestion?.originalLanguage || 
                              detectLanguage(newContent || '');
  
  const needsTranslation = originalSourceLang !== language || modifiedSourceLang !== language;
  const hasTranslation = translationResult?.original && translationResult?.modified;
  
  // Check if suggestion was written in a different language than original
  const isCrossLanguageSuggestion = originalSourceLang !== modifiedSourceLang;

  // Auto-translate if user's language differs from content - always
  useEffect(() => {
    if (needsTranslation && !isTranslating) {
      // Check if we need fresh translation
      if (!translationResult || 
          translationResult.sourceLanguages?.original !== originalSourceLang ||
          translationResult.sourceLanguages?.modified !== modifiedSourceLang) {
        handleSmartTranslate();
      }
    }
  }, [needsTranslation, originalSourceLang, modifiedSourceLang, language]);
  
  const handleSmartTranslate = async () => {
    if (isTranslating) return;
    setIsTranslating(true);
    try {
      const translateHtml = async (html, entityType, entityId, entityField, sourceLang, targetLang = language, anchor = null) => {
        if (sourceLang === targetLang) return html;
        const res = await base44.functions.invoke('translateVersion', {
          documentId,
          sourceEntityType: entityType,
          sourceEntityId: entityId,
          sourceField: entityField,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          content: html,
          isHtml: true,
          ...(anchor ? {
            anchorOriginalContent: anchor.anchorOriginalContent,
            anchorTranslatedContent: anchor.anchorTranslatedContent,
          } : {}),
        });
        return res.data?.translatedContent || html;
      };

      // Determine entity info for original content
      const originalEntityInfo = originalVersion
        ? { type: 'version', id: originalVersion.id, field: 'content' }
        : section
          ? { type: 'section', id: section.id, field: 'content' }
          : null;

      // Determine entity info for new content
      const newEntityInfo = suggestion
        ? { type: 'suggestion', id: suggestion.id, field: 'newContent' }
        : newVersion
          ? { type: 'version', id: newVersion.id, field: 'content' }
          : null;

      // Cross-language anchoring: when a suggestion was written in a different
      // language than the section, translate the proposed edit relative to the
      // section's existing translations. This keeps the translated suggestion
      // aligned with the section's original wording instead of drifting into an
      // independent re-translation (the "version C" problem).
      const useAnchor =
        isCrossLanguageSuggestion &&
        newEntityInfo?.type === 'suggestion' &&
        modifiedSourceLang !== language &&
        !!originalEntityInfo;

      let translatedOriginal = originalContent;
      let anchorTranslatedContent = null;

      if (originalEntityInfo) {
        // Fetch the section in the viewer's language and (when anchoring) in
        // the suggestion's source language — i.e. the translation the proposer
        // saw and edited. The latter is almost always already cached.
        const basePromises = [
          translateHtml(originalContent, originalEntityInfo.type, originalEntityInfo.id, originalEntityInfo.field, originalSourceLang, language),
        ];
        if (useAnchor) {
          basePromises.push(
            translateHtml(originalContent, originalEntityInfo.type, originalEntityInfo.id, originalEntityInfo.field, originalSourceLang, modifiedSourceLang)
              .catch(() => null)
          );
        }
        const baseResults = await Promise.all(basePromises);
        translatedOriginal = baseResults[0];
        anchorTranslatedContent = useAnchor ? baseResults[1] : null;
      }

      // Translate the proposed edit. When anchoring, pass the section in the
      // viewer's language (anchorOriginalContent) and the section in the
      // suggestion's language (anchorTranslatedContent) so the backend can
      // apply the edit to the original wording instead of re-translating.
      let translatedNew = newContent;
      if (newEntityInfo) {
        const anchor = useAnchor && anchorTranslatedContent
          ? { anchorOriginalContent: translatedOriginal, anchorTranslatedContent }
          : null;
        translatedNew = await translateHtml(newContent, newEntityInfo.type, newEntityInfo.id, newEntityInfo.field, modifiedSourceLang, language, anchor);
      }

      setTranslationResult({
        original: translatedOriginal,
        modified: translatedNew,
        fromCache: { original: false, modified: false },
        strategy: useAnchor && anchorTranslatedContent ? 'anchored' : 'direct',
        sourceLanguages: { original: originalSourceLang, modified: modifiedSourceLang }
      });
      setShowTranslated(true);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleToggleTranslation = async () => {
    if (!showTranslated && needsTranslation) {
      if (!hasTranslation) {
        await handleSmartTranslate();
        return;
      }
    }
    setShowTranslated(!showTranslated);
  };

  const displayOriginal = showTranslated && translationResult?.original 
    ? translationResult.original 
    : originalContent;
  const displayNew = showTranslated && translationResult?.modified 
    ? translationResult.modified 
    : newContent;
  
  // Check if both contents are in the same language for diff display
  const canShowDiff = useMemo(() => {
    // If translated - both are in same language
    if (showTranslated && hasTranslation) return true;
    
    // If not translated - check if original languages match
    return originalSourceLang === modifiedSourceLang;
  }, [showTranslated, hasTranslation, originalSourceLang, modifiedSourceLang]);
  
  const contentStyle = {
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: "var(--font-document)",
    fontSize: "1.375rem",
    lineHeight: "1.8",
    letterSpacing: "0.01em",
    fontWeight: "400"
  };

  // Render inline diff — change-block engine (old phrase → new phrase, no space)
  const renderInlineDiff = () => (
    <ChangeBlockDiffView
      originalContent={displayOriginal}
      newContent={displayNew}
      style={{ fontSize: contentStyle.fontSize, lineHeight: contentStyle.lineHeight, fontFamily: contentStyle.fontFamily }}
    />
  );

  // Render split view (stacked) — preserves rich-text formatting
  const renderSplitDiff = () => (
    <div className="space-y-3">
      <div className="p-3 bg-red-50/50 border border-red-200 rounded-lg overflow-hidden">
        <div className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          {t('originalContent') || 'מקור'}
        </div>
        <div style={{...contentStyle, wordWrap: 'break-word', overflowWrap: 'break-word', minWidth: 0}} className="text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayOriginal) }} />
      </div>
      <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg overflow-hidden">
        <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          {t('proposedContent') || 'מוצע'}
        </div>
        <div style={{...contentStyle, wordWrap: 'break-word', overflowWrap: 'break-word', minWidth: 0}} className="text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayNew) }} />
      </div>
    </div>
  );

  // Render side-by-side view — collapses to stacked below sm breakpoint
  const renderSideBySideDiff = () => (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${isRTL ? 'direction-rtl' : ''}`}>
      <div className="p-3 bg-red-50/50 border border-red-200 rounded-lg overflow-hidden">
        <div className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          {t('originalContent') || 'מקור'}
        </div>
        <div style={{...contentStyle, wordWrap: 'break-word', overflowWrap: 'break-word', minWidth: 0}} className="text-slate-700 text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayOriginal) }} />
      </div>
      <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg overflow-hidden">
        <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          {t('proposedContent') || 'מוצע'}
        </div>
        <div style={{...contentStyle, wordWrap: 'break-word', overflowWrap: 'break-word', minWidth: 0}} className="text-slate-700 text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayNew) }} />
      </div>
    </div>
  );
  
  const handleCardClick = (e) => {
    // Don't navigate if clicked on a button or control
    if (e.target.closest('button, a, [role="button"]')) {
      return;
    }
    
    if (suggestion?.id && typeof window !== 'undefined') {
      // Open suggestion sidebar instead of navigation
      const event = new CustomEvent('openSuggestionSidebar', {
        detail: { suggestionId: suggestion.id }
      });
      window.dispatchEvent(event);
    }
  };

  return (
    <Card 
      className="p-4 bg-slate-50 border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
      onClick={handleCardClick}
    >
      <div 
        className="flex items-center justify-between mb-2 gap-2"
      >
          <div className="text-xs font-semibold text-slate-600 shrink-0">{t('proposedChanges')}</div>
        <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {showDiff && canShowDiff && (
            <DiffModeSelector 
              mode={diffMode} 
              onModeChange={(newMode) => {
                setDiffMode(newMode);
              }}
            />
          )}
          {canShowDiff && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDiff(!showDiff);
              }}
              className={`h-7 px-2 gap-1 ${showDiff ? 'bg-blue-50 text-blue-600' : 'text-slate-600'} hover:bg-blue-50`}
              title={showDiff ? t('cleanView') : t('showChangesView')}
            >
              {showDiff ? <FileText className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="text-xs hidden sm:inline">{showDiff ? t('hideChanges') : t('showDiff')}</span>
            </Button>
          )}
          {needsTranslation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async (e) => {
                e.stopPropagation();
                await handleToggleTranslation();
              }}
              disabled={isTranslating}
              className={`h-7 px-2 gap-1 ${showTranslated ? 'bg-green-50 text-green-600' : 'text-slate-600'} hover:bg-blue-50`}
              title={showTranslated ? t('showOriginal') : t('translate')}
            >
              {isTranslating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : showTranslated ? (
                <Check className="w-4 h-4" />
              ) : (
                <Languages className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      
      {/* Cross-language warning */}
      {isCrossLanguageSuggestion && !showTranslated && (
        <Alert className="mb-3 bg-amber-50 border-amber-200" onClick={(e) => e.stopPropagation()}>
          <Info className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-xs">
            {isRTL 
              ? `הצעה זו נכתבה בשפה אחרת. תרגם כדי לראות תצוגת שינויים.`
              : `This suggestion was written in a different language. Translate to see changes view.`
            }
          </AlertDescription>
        </Alert>
      )}
      
      {/* Translation indicator - clickable to toggle */}
      {showTranslated && hasTranslation && (
        <div 
          className="flex items-center gap-2 mb-2 flex-wrap"
        >
          <Badge 
            variant="outline" 
            className="bg-green-50 text-green-700 border-green-200 text-xs cursor-pointer hover:bg-green-100 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowTranslated(false);
            }}
            title={t('showOriginal') || 'הצג מקור'}
          >
            <Check className="w-3 h-3 mr-1" />
            {t('translated')} | {t('showOriginal')}
          </Badge>
        </div>
      )}
      
      <div 
        className="prose prose-sm max-w-none rounded-lg p-2 -m-2"
        style={{ minWidth: 0, wordWrap: 'break-word', overflowWrap: 'break-word' }}
        onClick={(e) => e.stopPropagation()}
      >
        {isTranslating ? (
          <div className="flex items-center justify-center py-4 gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{t('translating')}</span>
          </div>
        ) : !showDiff || !canShowDiff ? (
          <div style={contentStyle} dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayNew) }} />
        ) : diffMode === DIFF_MODES.INLINE ? (
          renderInlineDiff()
        ) : diffMode === DIFF_MODES.SPLIT ? (
          renderSplitDiff()
        ) : (
          renderSideBySideDiff()
        )}
      </div>
    </Card>
  );
}