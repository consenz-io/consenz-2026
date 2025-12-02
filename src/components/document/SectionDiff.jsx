import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Languages, Loader2, Eye, FileText } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import { detectLanguage, translateForDiff } from "@/components/utils/translationUtils";

export default function SectionDiff({ 
  originalContent, 
  newContent, 
  documentId, 
  sectionId, 
  suggestion,
  originalEntity,  // אופציונלי - ישות המכילה את התוכן המקורי (לדוגמה DocumentVersion)
  originalEntityType = 'DocumentVersion' // סוג הישות המקורית
}) {
  const { t, language, isRTL } = useLanguage();
  const [translatedOriginal, setTranslatedOriginal] = useState(null);
  const [translatedNew, setTranslatedNew] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [autoTranslated, setAutoTranslated] = useState(false);
  
  // זיהוי שפות התוכן
  const originalLang = originalEntity?.originalLanguage || detectLanguage(originalContent || '');
  const newLang = suggestion?.originalLanguage || detectLanguage(newContent || '');
  
  // בדיקה אם צריך תרגום - אם אחת השפות שונה משפת התצוגה
  const needsTranslation = originalLang !== language || newLang !== language;
  
  // בדיקה אם השפות של שני התכנים שונות זו מזו
  const crossLanguageDiff = originalLang !== newLang;

  // תרגום אוטומטי כאשר יש שפות שונות
  useEffect(() => {
    const autoTranslate = async () => {
      if (crossLanguageDiff && !autoTranslated && !isTranslating) {
        setIsTranslating(true);
        try {
          const { translatedOriginal: transOrig, translatedNew: transNew } = await translateForDiff({
            originalContent,
            newContent,
            originalEntity,
            newEntity: suggestion,
            originalEntityType,
            newEntityType: 'Suggestion',
            targetLanguage: language
          });
          
          setTranslatedOriginal(transOrig);
          setTranslatedNew(transNew);
          setShowTranslated(true);
          setAutoTranslated(true);
        } catch (error) {
          console.error('Auto translation error:', error);
        } finally {
          setIsTranslating(false);
        }
      }
    };
    
    autoTranslate();
  }, [crossLanguageDiff, originalContent, newContent, language, autoTranslated]);

  const handleTranslate = async () => {
    // אם כבר מוצג תרגום - החזר למקור
    if (showTranslated && (translatedOriginal || translatedNew)) {
      setShowTranslated(false);
      return;
    }
    
    // אם יש תרגום שמור - הצג אותו
    if (translatedOriginal || translatedNew) {
      setShowTranslated(true);
      return;
    }

    // בצע תרגום
    setIsTranslating(true);
    try {
      const { translatedOriginal: transOrig, translatedNew: transNew } = await translateForDiff({
        originalContent,
        newContent,
        originalEntity,
        newEntity: suggestion,
        originalEntityType,
        newEntityType: 'Suggestion',
        targetLanguage: language
      });
      
      setTranslatedOriginal(transOrig);
      setTranslatedNew(transNew);
      setShowTranslated(true);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };
  
  const getTextContent = (html) => {
    if (!html) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || '';
  };

  // בחירת התוכן להצגה
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
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-700">{t('proposedChanges')}</div>
          {crossLanguageDiff && showTranslated && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {t('translatedFrom')} {originalLang !== language ? originalLang : ''}{originalLang !== newLang ? ` / ${newLang}` : ''}
            </span>
          )}
        </div>
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
                handleTranslate();
              }}
              disabled={isTranslating}
              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              title={showTranslated ? t('showOriginal') : t('translate')}
            >
              {isTranslating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Languages className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      
      {isTranslating && crossLanguageDiff && !autoTranslated ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className={`${isRTL ? 'mr-2' : 'ml-2'} text-sm text-slate-600`}>{t('translating')}</span>
        </div>
      ) : (
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
          {!showDiff ? (
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
      )}
    </Card>
  );
}