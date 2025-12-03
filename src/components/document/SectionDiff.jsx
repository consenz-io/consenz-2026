import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
  const { t, language, isRTL } = useLanguage();
  const [translationResult, setTranslationResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const [diffMode, setDiffMode] = useDiffMode();
  
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

  // Auto-translate if user's language differs from content
  useEffect(() => {
    if (needsTranslation && !translationResult && !isTranslating) {
      handleSmartTranslate();
    }
  }, [language]);
  
  const handleSmartTranslate = async () => {
    if (isTranslating) return;
    
    setIsTranslating(true);
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
      console.error('Smart translation error:', error);
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
  
  // Compute diff with memoization
  const diff = useMemo(() => {
    const oldText = extractText(displayOriginal);
    const newText = extractText(displayNew);
    const oldTokens = tokenize(oldText);
    const newTokens = tokenize(newText);
    return computeWordDiff(oldTokens, newTokens);
  }, [displayOriginal, displayNew]);
  
  const navigate = useNavigate();
  
  const handleCardClick = () => {
    if (documentId && sectionId) {
      navigate(`${createPageUrl("DocumentView")}?id=${documentId}#section-${sectionId}`);
      setTimeout(() => {
        const element = document.getElementById(`section-${sectionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  };

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
  const renderInlineDiff = () => (
    <div style={contentStyle}>
      {diff.map((part, idx) => {
        if (part.type === 'removed') {
          return (
            <span key={idx} className="bg-[#fef2f2] text-red-700 line-through opacity-70">
              {part.value}
            </span>
          );
        } else if (part.type === 'added') {
          return (
            <span key={idx} className="bg-[#dcfce7] text-green-800 border-b-2 border-green-500 font-medium">
              {part.value}
            </span>
          );
        } else {
          return <span key={idx}>{part.value}</span>;
        }
      })}
    </div>
  );

  // Render split view (stacked)
  const renderSplitDiff = () => (
    <div className="space-y-3">
      <div className="p-3 bg-red-50/50 border border-red-200 rounded-lg">
        <div className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          {t('originalContent') || 'מקור'}
        </div>
        <div style={contentStyle} className="text-slate-700">
          {extractText(displayOriginal)}
        </div>
      </div>
      <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg">
        <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          {t('proposedContent') || 'מוצע'}
        </div>
        <div style={contentStyle} className="text-slate-700">
          {extractText(displayNew)}
        </div>
      </div>
    </div>
  );

  // Render side-by-side view
  const renderSideBySideDiff = () => (
    <div className={`grid grid-cols-2 gap-3 ${isRTL ? 'direction-rtl' : ''}`}>
      <div className="p-3 bg-red-50/50 border border-red-200 rounded-lg">
        <div className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          {t('originalContent') || 'מקור'}
        </div>
        <div style={contentStyle} className="text-slate-700 text-sm">
          {extractText(displayOriginal)}
        </div>
      </div>
      <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg">
        <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          {t('proposedContent') || 'מוצע'}
        </div>
        <div style={contentStyle} className="text-slate-700 text-sm">
          {extractText(displayNew)}
        </div>
      </div>
    </div>
  );
  
  return (
    <Card 
      className="p-4 bg-slate-50 border-slate-200 cursor-pointer hover:bg-slate-100 hover:shadow-md transition-all"
      onClick={handleCardClick}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm font-semibold text-slate-700">{t('proposedChanges')}</div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {showDiff && (
            <DiffModeSelector 
              mode={diffMode} 
              onModeChange={(newMode) => {
                setDiffMode(newMode);
              }}
            />
          )}
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
      
      {/* Translation indicator - clickable to toggle */}
      {showTranslated && hasTranslation && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
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
            {t('translatedFrom') || 'תורגם מ'} {languageLabels[originalSourceLang] || originalSourceLang} - {t('showOriginal') || 'הצג מקור'}
          </Badge>
          {translationResult?.fromCache?.original && translationResult?.fromCache?.modified && (
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
              ✓ {t('fromCache') || 'מהמטמון'}
            </Badge>
          )}
        </div>
      )}
      
      <div className="prose prose-sm max-w-none">
        {isTranslating ? (
          <div className="flex items-center justify-center py-4 gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{t('translating')}</span>
          </div>
        ) : !showDiff ? (
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