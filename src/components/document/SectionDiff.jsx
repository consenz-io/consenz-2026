import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Languages, Loader2, Eye, FileText, Check } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import { detectLanguage, translateContent } from "./translationService";
import DiffModeSelector, { DIFF_MODES, useDiffMode } from "./DiffModeSelector";
import { extractText, tokenize, computeWordDiff } from "./InlineDiff";

export default function SectionDiff({ 
  originalContent, 
  newContent, 
  documentId, 
  sectionId, 
  suggestion,
  originalVersion,
  newVersion
}) {
  const { t, language, isRTL } = useLanguage();
  const [translatedOriginal, setTranslatedOriginal] = useState(null);
  const [translatedNew, setTranslatedNew] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const [diffMode, setDiffMode] = useDiffMode();
  
  const originalLanguage = originalVersion?.originalLanguage || suggestion?.originalLanguage || detectLanguage(originalContent || '');
  const newLanguage = newVersion?.originalLanguage || suggestion?.originalLanguage || detectLanguage(newContent || '');
  
  const originalNeedsTranslation = language !== originalLanguage;
  const newNeedsTranslation = language !== newLanguage;
  const needsTranslation = originalNeedsTranslation || newNeedsTranslation;
  const hasTranslation = translatedOriginal && translatedNew;

  useEffect(() => {
    if (showTranslated && needsTranslation && !translatedOriginal && !translatedNew) {
      handleTranslateBoth();
    }
  }, [showTranslated]);
  
  const handleTranslateBoth = async () => {
    if (isTranslating) return;
    
    const cachedOriginal = originalVersion?.translations?.[language] || 
                           (originalLanguage === language ? originalContent : null);
    const cachedNew = newVersion?.translations?.[language] || 
                      suggestion?.translations?.[language]?.newContent ||
                      (newLanguage === language ? newContent : null);
    
    if (cachedOriginal && cachedNew) {
      setTranslatedOriginal(cachedOriginal);
      setTranslatedNew(cachedNew);
      return;
    }

    setIsTranslating(true);
    try {
      const translationPromises = [];
      
      if (originalNeedsTranslation && !cachedOriginal) {
        translationPromises.push(
          translateContent(originalContent, language).then(result => {
            setTranslatedOriginal(result);
            if (originalVersion?.id) {
              const newTranslations = { ...(originalVersion.translations || {}), [language]: result };
              base44.entities.DocumentVersion.update(originalVersion.id, { translations: newTranslations }).catch(() => {});
            }
            return result;
          })
        );
      } else {
        setTranslatedOriginal(cachedOriginal || originalContent);
      }
      
      if (newNeedsTranslation && !cachedNew) {
        translationPromises.push(
          translateContent(newContent, language).then(result => {
            setTranslatedNew(result);
            if (newVersion?.id) {
              const newTranslations = { ...(newVersion.translations || {}), [language]: result };
              base44.entities.DocumentVersion.update(newVersion.id, { translations: newTranslations }).catch(() => {});
            } else if (suggestion?.id) {
              const newTranslations = {
                ...(suggestion.translations || {}),
                [language]: { ...(suggestion.translations?.[language] || {}), newContent: result }
              };
              base44.entities.Suggestion.update(suggestion.id, { translations: newTranslations }).catch(() => {});
            }
            return result;
          })
        );
      } else {
        setTranslatedNew(cachedNew || newContent);
      }
      
      await Promise.all(translationPromises);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleToggleTranslation = async () => {
    if (!showTranslated && needsTranslation) {
      if (!translatedOriginal || !translatedNew) {
        await handleTranslateBoth();
      }
    }
    setShowTranslated(!showTranslated);
  };

  const displayOriginal = showTranslated && translatedOriginal ? translatedOriginal : originalContent;
  const displayNew = showTranslated && translatedNew ? translatedNew : newContent;
  
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
      
      {/* Translation indicator */}
      {showTranslated && hasTranslation && (
        <Badge variant="outline" className="mb-2 bg-green-50 text-green-700 border-green-200 text-xs">
          <Check className="w-3 h-3 mr-1" />
          {t('translatedFrom') || 'מתורגם'}
        </Badge>
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