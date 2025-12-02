import React, { useState, useEffect } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { detectLanguage, translateForDiff } from "@/components/utils/translationUtils";
import { Loader2 } from "lucide-react";

const InlineDiff = ({ originalContent, newContent, originalEntity, newEntity }) => {
  const { isRTL, language } = useLanguage();
  const [translatedOriginal, setTranslatedOriginal] = useState(null);
  const [translatedNew, setTranslatedNew] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // זיהוי שפות
  const originalLang = originalEntity?.originalLanguage || detectLanguage(originalContent || '');
  const newLang = newEntity?.originalLanguage || detectLanguage(newContent || '');
  const crossLanguageDiff = originalLang !== newLang;
  
  // תרגום אוטומטי כאשר יש שפות שונות
  useEffect(() => {
    const autoTranslate = async () => {
      if (crossLanguageDiff && !isTranslating && !translatedOriginal && !translatedNew) {
        setIsTranslating(true);
        try {
          const { translatedOriginal: transOrig, translatedNew: transNew } = await translateForDiff({
            originalContent,
            newContent,
            originalEntity,
            newEntity,
            originalEntityType: 'DocumentVersion',
            newEntityType: 'DocumentVersion',
            targetLanguage: language
          });
          
          setTranslatedOriginal(transOrig);
          setTranslatedNew(transNew);
        } catch (error) {
          console.error('InlineDiff auto translation error:', error);
        } finally {
          setIsTranslating(false);
        }
      }
    };
    
    autoTranslate();
  }, [crossLanguageDiff, originalContent, newContent, language]);
  
  // בחירת תוכן להשוואה
  const displayOriginal = crossLanguageDiff && translatedOriginal ? translatedOriginal : originalContent;
  const displayNew = crossLanguageDiff && translatedNew ? translatedNew : newContent;
  
  // Extract text from HTML
  const extractText = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const originalText = extractText(originalContent);
  const newText = extractText(newContent);

  // Tokenize text - מפריד מילים, סימני פיסוק ורווחים כטוקנים נפרדים
  const tokenize = (text) => {
    const tokens = text.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}\s]+|\s+/gu) || [];
    return tokens;
  };

  // LCS-based diff algorithm - מזהה רצפים משותפים ארוכים
  const diffWords = (oldText, newText) => {
    const oldTokens = tokenize(oldText);
    const newTokens = tokenize(newText);
    
    // Build LCS table
    const m = oldTokens.length;
    const n = newTokens.length;
    const lcs = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldTokens[i - 1] === newTokens[j - 1]) {
          lcs[i][j] = lcs[i - 1][j - 1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
        }
      }
    }
    
    // Backtrack to find the diff
    const result = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
        result.unshift({ type: 'unchanged', value: oldTokens[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
        result.unshift({ type: 'added', value: newTokens[j - 1] });
        j--;
      } else if (i > 0) {
        result.unshift({ type: 'removed', value: oldTokens[i - 1] });
        i--;
      }
    }
    
    return result;
  };

  // Group consecutive changes - קיבוץ מתוקן עם התעלמות מ-unchanged קצרים
  const groupChanges = (diffs) => {
    if (diffs.length === 0) return [];
    
    const grouped = [];
    let i = 0;
    
    while (i < diffs.length) {
      const current = diffs[i];
      
      // בדוק אם זה unchanged ארוך (5+ מילים)
      if (current.type === 'unchanged') {
        // אסוף את כל ה-unchanged הרצופים
        let unchangedTokens = [current];
        let j = i + 1;
        while (j < diffs.length && diffs[j].type === 'unchanged') {
          unchangedTokens.push(diffs[j]);
          j++;
        }
        
        // אם זה רצף ארוך של unchanged - זה באמת לא השתנה
        const unchangedText = unchangedTokens.map(t => t.value).join('');
        const wordCount = unchangedText.trim().split(/\s+/).length;
        
        if (wordCount >= 5) {
          // רצף ארוך - הצג כ-unchanged
          grouped.push({
            type: 'unchanged',
            value: unchangedText
          });
          i = j;
        } else {
          // רצף קצר - כלול אותו בבלוק השינויים הבא
          // פשוט נמשיך הלאה ונאסף אותו עם השינויים
          i = j;
        }
      } else {
        // אם removed או added - אסוף את כל הרצף (כולל unchanged קצרים!)
        let removedParts = [];
        let addedParts = [];
        let j = i;
        
        while (j < diffs.length) {
          // בדוק אם הגענו לרצף ארוך של unchanged
          if (diffs[j].type === 'unchanged') {
            // אסוף את ה-unchanged עד שמסתיים
            let unchangedCount = 0;
            let k = j;
            let unchangedText = '';
            while (k < diffs.length && diffs[k].type === 'unchanged') {
              unchangedText += diffs[k].value;
              k++;
            }
            
            const wordCount = unchangedText.trim().split(/\s+/).length;
            
            if (wordCount >= 5) {
              // רצף ארוך - עצור כאן
              break;
            } else {
              // רצף קצר - כלול אותו בשינוי
              while (j < k) {
                // הוסף ל-removed וגם ל-added (זה לא השתנה אבל בתוך בלוק שינוי)
                removedParts.push(diffs[j].value);
                addedParts.push(diffs[j].value);
                j++;
              }
            }
          } else if (diffs[j].type === 'removed') {
            removedParts.push(diffs[j].value);
            j++;
          } else if (diffs[j].type === 'added') {
            addedParts.push(diffs[j].value);
            j++;
          }
        }
        
        // צור בלוק לפי מה שנאסף
        if (removedParts.length > 0 && addedParts.length > 0) {
          grouped.push({
            type: 'replaced',
            deleted: removedParts.join(''),
            added: addedParts.join('')
          });
        } else if (removedParts.length > 0) {
          grouped.push({
            type: 'removed',
            value: removedParts.join('')
          });
        } else if (addedParts.length > 0) {
          grouped.push({
            type: 'added',
            value: addedParts.join('')
          });
        }
        
        i = j;
      }
    }
    
    return grouped;
  };

  const differences = groupChanges(diffWords(originalText, newText));

  return (
    <div className="text-slate-700 leading-relaxed prose prose-slate max-w-none" dir={isRTL ? 'rtl' : 'ltr'}>
      {differences.map((part, index) => {
        if (part.type === 'added') {
          return (
            <span
              key={index}
              className="bg-green-100 text-green-800 font-medium px-1 rounded"
            >
              {part.value}
            </span>
          );
        }
        if (part.type === 'removed') {
          return (
            <span
              key={index}
              className="bg-red-100 text-red-800 line-through px-1 rounded"
            >
              {part.value}
            </span>
          );
        }
        if (part.type === 'replaced') {
          return (
            <span key={index}>
              <span className="bg-red-100 text-red-800 line-through px-1 rounded">
                {part.deleted}
              </span>
              <span className="bg-green-100 text-green-800 font-medium px-1 rounded">
                {part.added}
              </span>
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
};

export default InlineDiff;