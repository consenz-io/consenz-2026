import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Languages, Loader2, Eye, FileText } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";

const detectLanguage = (text) => {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

export default function SectionDiff({ originalContent, newContent, documentId, sectionId, suggestion }) {
  const { t, language, isRTL } = useLanguage();
  const [translatedContent, setTranslatedContent] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  
  // זיהוי אוטומטי של שפת התוכן המוצע - בודק את ה-suggestion או מזהה אוטומטית
  const contentLanguage = suggestion?.originalLanguage || detectLanguage(newContent || '');
  const needsTranslation = language !== contentLanguage;
  
  const getTextContent = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || '';
  };

  const handleTranslate = async () => {
    // בדיקה אם יש תרגום שמור ב-suggestion
    const cachedTranslation = suggestion?.translations?.[language]?.newContent;
    
    if (showTranslated && (translatedContent || cachedTranslation)) {
      setShowTranslated(false);
      return;
    }
    
    if (translatedContent || cachedTranslation) {
      if (cachedTranslation && !translatedContent) {
        setTranslatedContent(cachedTranslation);
      }
      setShowTranslated(true);
      return;
    }

    setIsTranslating(true);
    try {
      const languagePrompts = { en: "English", he: "Hebrew", ar: "Arabic" };
      const prompt = `You are a professional translator. Translate the following HTML content to ${languagePrompts[language]}.

CRITICAL INSTRUCTIONS:
- Keep ALL HTML tags exactly as they are
- Only translate the TEXT CONTENT between the tags
- Return ONLY the translated HTML, nothing else
- Do not add any explanations or comments
- Maintain exact same structure and formatting

HTML content to translate:
${newContent}

Return ONLY the translated HTML:`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false,
      });

      let translated = typeof result === 'string' ? result : result.content || result;
      translated = translated.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      
      setTranslatedContent(translated);
      setShowTranslated(true);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const contentToDisplay = showTranslated && translatedContent ? translatedContent : newContent;
  const originalText = getTextContent(originalContent);
  const displayText = getTextContent(contentToDisplay);
  
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
          <div dangerouslySetInnerHTML={{ __html: contentToDisplay }} />
        ) : showTranslated && translatedContent ? (
          <div dangerouslySetInnerHTML={{ __html: translatedContent }} />
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