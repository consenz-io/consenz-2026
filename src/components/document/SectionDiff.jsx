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
import { getDiffInLanguage, detectLanguage } from "./SmartDiffTranslationService";
import DiffModeSelector, { DIFF_MODES, useDiffMode } from "./DiffModeSelector";
import { extractText, tokenize, computeWordDiff } from "./InlineDiff";

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
    const languagePrompts = { en: 'English', he: 'Hebrew', ar: 'Arabic' };
    try {
      const result = await getDiffInLanguage({
        originalContent,
        modifiedContent: newContent,
        originalEntity: originalVersion || section,
        originalEntityType: originalVersion ? 'DocumentVersion' : 'Section',
        modifiedEntity: suggestion || newVersion,
        modifiedEntityType: suggestion ? 'Suggestion' : 'DocumentVersion',
        targetLanguage: language,
        originalFieldName: 'content',
        modifiedFieldName: suggestion ? 'newContent' : 'content'
      });
      setTranslationResult(result);
      setShowTranslated(true);
    } catch (error) {
      // getDiffInLanguage failed (likely disabled cache-miss paths) — fall back to direct InvokeLLM
      try {
        const translateHtml = async (html) => {
          const res = await base44.integrations.Core.InvokeLLM({
            prompt: `Translate the following HTML content to ${languagePrompts[language]}. Preserve all HTML tags exactly. Return only the translated HTML with no commentary:\n${html}`
          });
          const text = typeof res === 'string' ? res : res?.content || res?.text || html;
          return text.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
        };

        const [translatedOriginal, translatedNew] = await Promise.all([
          originalSourceLang !== language ? translateHtml(originalContent) : Promise.resolve(originalContent),
          modifiedSourceLang !== language ? translateHtml(newContent) : Promise.resolve(newContent)
        ]);

        setTranslationResult({
          original: translatedOriginal,
          modified: translatedNew,
          fromCache: { original: false, modified: false },
          strategy: 'direct',
          sourceLanguages: { original: originalSourceLang, modified: modifiedSourceLang }
        });
        setShowTranslated(true);
      } catch (fallbackError) {
        console.error('Translation fallback error:', fallbackError);
      }
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
  
  // Compute diff with memoization
  const diff = useMemo(() => {
    if (!canShowDiff) return [];
    const oldText = extractText(displayOriginal);
    const newText = extractText(displayNew);
    const oldTokens = tokenize(oldText);
    const newTokens = tokenize(newText);
    return computeWordDiff(oldTokens, newTokens);
  }, [displayOriginal, displayNew, canShowDiff]);

  const contentStyle = {
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
    fontSize: "1.125rem",
    lineHeight: "1.8",
    letterSpacing: "0.01em",
    fontWeight: "400"
  };

  // Render inline diff
  const renderInlineDiff = () => {
    return (
      <div style={{...contentStyle, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {diff.map((part, idx) => {
          if (part.type === 'removed') {
            return (
              <span key={idx} className="bg-[#fef2f2] text-red-700 line-through opacity-70 inline">
                {part.value}
              </span>
            );
          } else if (part.type === 'added') {
            return (
              <span key={idx} className="bg-[#dcfce7] text-green-800 border-b-2 border-green-500 font-medium inline">
                {part.value}
              </span>
            );
          } else {
            return <span key={idx} className="inline">{part.value}</span>;
          }
        })}
      </div>
    );
  };

  // Render split view (stacked)
  const renderSplitDiff = () => (
    <div className="space-y-3">
      <div className="p-3 bg-red-50/50 border border-red-200 rounded-lg overflow-hidden">
        <div className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          {t('originalContent') || 'מקור'}
        </div>
        <div style={{...contentStyle, wordWrap: 'break-word', overflowWrap: 'break-word', minWidth: 0}} className="text-slate-700">
          {extractText(displayOriginal)}
        </div>
      </div>
      <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg overflow-hidden">
        <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          {t('proposedContent') || 'מוצע'}
        </div>
        <div style={{...contentStyle, wordWrap: 'break-word', overflowWrap: 'break-word', minWidth: 0}} className="text-slate-700">
          {extractText(displayNew)}
        </div>
      </div>
    </div>
  );

  // Render side-by-side view
  const renderSideBySideDiff = () => (
    <div className={`grid grid-cols-2 gap-3 ${isRTL ? 'direction-rtl' : ''}`}>
      <div className="p-3 bg-red-50/50 border border-red-200 rounded-lg overflow-hidden">
        <div className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          {t('originalContent') || 'מקור'}
        </div>
        <div style={{...contentStyle, wordWrap: 'break-word', overflowWrap: 'break-word', minWidth: 0}} className="text-slate-700 text-sm">
          {extractText(displayOriginal)}
        </div>
      </div>
      <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg overflow-hidden">
        <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          {t('proposedContent') || 'מוצע'}
        </div>
        <div style={{...contentStyle, wordWrap: 'break-word', overflowWrap: 'break-word', minWidth: 0}} className="text-slate-700 text-sm">
          {extractText(displayNew)}
        </div>
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
        className="flex items-center justify-between mb-3 flex-wrap gap-2"
      >
          <div className="text-sm font-semibold text-slate-700">{t('proposedChanges')}</div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
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
          <div style={contentStyle} dangerouslySetInnerHTML={{ __html: displayNew }} />
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