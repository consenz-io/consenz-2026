import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Languages, Loader2, Eye, FileText } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import { detectLanguage, translateContent } from "./translationService";

export default function SectionDiff({ 
  originalContent, 
  newContent, 
  documentId, 
  sectionId, 
  suggestion,
  originalVersion,  // DocumentVersion entity for original content
  newVersion        // DocumentVersion entity for new content
}) {
  const { t, language, isRTL } = useLanguage();
  const [translatedOriginal, setTranslatedOriginal] = useState(null);
  const [translatedNew, setTranslatedNew] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false); // Default to original language
  const [showDiff, setShowDiff] = useState(false);
  
  // Detect languages for both contents
  const originalLanguage = originalVersion?.originalLanguage || suggestion?.originalLanguage || detectLanguage(originalContent || '');
  const newLanguage = newVersion?.originalLanguage || suggestion?.originalLanguage || detectLanguage(newContent || '');
  
  // Check if either content needs translation
  const originalNeedsTranslation = language !== originalLanguage;
  const newNeedsTranslation = language !== newLanguage;
  const needsTranslation = originalNeedsTranslation || newNeedsTranslation;

  // Only translate when user explicitly requests it
  useEffect(() => {
    if (showTranslated && needsTranslation && !translatedOriginal && !translatedNew) {
      handleTranslateBoth();
    }
  }, [showTranslated]);
  
  const getTextContent = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || '';
  };

  const handleTranslateBoth = async () => {
    if (isTranslating) return;
    
    // Check for cached translations
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
      
      // Translate original if needed
      if (originalNeedsTranslation && !cachedOriginal) {
        translationPromises.push(
          translateContent(originalContent, language).then(result => {
            setTranslatedOriginal(result);
            // Cache in version if available
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
      
      // Translate new content if needed
      if (newNeedsTranslation && !cachedNew) {
        translationPromises.push(
          translateContent(newContent, language).then(result => {
            setTranslatedNew(result);
            // Cache in version or suggestion if available
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

  const handleToggleTranslation = () => {
    if (!showTranslated && needsTranslation) {
      handleTranslateBoth();
    }
    setShowTranslated(!showTranslated);
  };

  // Determine which content to use for display and diff
  const displayOriginal = showTranslated && translatedOriginal ? translatedOriginal : originalContent;
  const displayNew = showTranslated && translatedNew ? translatedNew : newContent;
  
  const originalText = getTextContent(displayOriginal);
  const displayText = getTextContent(displayNew);
  
  const computeDiffForDisplay = () => {
    const originalWords = originalText.split(/(\s+)/);
    const displayWords = displayText.split(/(\s+)/);
    
    const result = [];
    let i = 0, j = 0;

    while (i < originalWords.length || j < displayWords.length) {
      if (i >= originalWords.length) {
        result.push({ type: 'added', text: displayWords.slice(j).join('') });
        break;
      }
      if (j >= displayWords.length) {
        result.push({ type: 'removed', text: originalWords.slice(i).join('') });
        break;
      }

      if (originalWords[i] === displayWords[j]) {
        result.push({ type: 'unchanged', text: displayWords[j] });
        i++;
        j++;
      } else {
        let foundMatch = false;
        for (let k = j + 1; k < Math.min(j + 10, displayWords.length); k++) {
          if (originalWords[i] === displayWords[k]) {
            result.push({ type: 'added', text: displayWords.slice(j, k).join('') });
            j = k;
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) {
          for (let k = i + 1; k < Math.min(i + 10, originalWords.length); k++) {
            if (displayWords[j] === originalWords[k]) {
              result.push({ type: 'removed', text: originalWords.slice(i, k).join('') });
              i = k;
              foundMatch = true;
              break;
            }
          }
        }
        if (!foundMatch) {
          result.push({ type: 'removed', text: originalWords[i] });
          result.push({ type: 'added', text: displayWords[j] });
          i++;
          j++;
        }
      }
    }

    return result;
  };

  const diff = computeDiffForDisplay();
  
  const navigate = useNavigate();
  
  const handleCardClick = () => {
    if (documentId && sectionId) {
      navigate(`${createPageUrl("DocumentView")}?id=${documentId}#section-${sectionId}`);
      // Scroll to section after navigation
      setTimeout(() => {
        const element = document.getElementById(`section-${sectionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  };
  
  return (
    <Card 
      className="p-4 bg-slate-50 border-slate-200 cursor-pointer hover:bg-slate-100 hover:shadow-md transition-all"
      onClick={handleCardClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-700">{t('proposedChanges')}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowDiff(!showDiff);
            }}
            className={`h-7 px-2 gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 ${isRTL ? 'flex-row-reverse' : ''}`}
            title={showDiff ? t('cleanView') : t('showChangesView')}
          >
            {showDiff ? <Eye className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            <span className="text-xs">{showDiff ? t('cleanView') : t('showChangesView')}</span>
          </Button>
          {needsTranslation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTranslation();
              }}
              disabled={isTranslating}
              className={`h-7 px-2 gap-1 ${showTranslated ? 'text-blue-600' : 'text-slate-600'} hover:text-blue-700 hover:bg-blue-50`}
              title={showTranslated ? t('showOriginal') : t('translate')}
            >
              {isTranslating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Languages className="w-4 h-4" />
              )}
              <span className="text-xs">{showTranslated ? t('showOriginal') : t('translate')}</span>
            </Button>
          )}
        </div>
      </div>
      <div 
        className="prose prose-sm max-w-none" 
        style={{ 
          direction: isRTL ? 'rtl' : 'ltr', 
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
          fontSize: "1.125rem",
          lineHeight: "1.8",
          letterSpacing: "0.01em",
          fontWeight: "400"
        }}
      >
        {isTranslating ? (
          <div className="flex items-center justify-center py-4 gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{t('translating')}</span>
          </div>
        ) : !showDiff ? (
          <div dangerouslySetInnerHTML={{ __html: displayNew }} />
        ) : (
          diff.map((part, idx) => {
            if (part.type === 'removed') {
              return (
                <span key={idx} className="bg-red-100 text-red-800 line-through px-1 rounded">
                  {part.text}
                </span>
              );
            } else if (part.type === 'added') {
              return (
                <span key={idx} className="bg-green-100 text-green-800 px-1 rounded font-medium">
                  {part.text}
                </span>
              );
            } else {
              return <span key={idx}>{part.text}</span>;
            }
          })
        )}
      </div>
    </Card>
  );
}