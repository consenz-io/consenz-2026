import React from "react";
import { useLanguage } from "@/components/LanguageContext";

const InlineDiff = ({ originalContent, newContent }) => {
  const { isRTL } = useLanguage();
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
    // מפריד לפי: מילים (אותיות/מספרים) | סימני פיסוק | רווחים
    // כל אחד מהם הוא טוקן נפרד כדי ש-LCS יזהה במדויק מה השתנה
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

  // Group consecutive changes - מאחד בלוקים של שינויים
  const groupChanges = (diffs) => {
    if (diffs.length === 0) return [];
    
    const grouped = [];
    let i = 0;
    
    while (i < diffs.length) {
      const current = diffs[i];
      
      if (current.type === 'unchanged') {
        // עבור unchanged - פשוט מקבץ tokens רצופים
        const sameTypeGroup = [current];
        let j = i + 1;
        while (j < diffs.length && diffs[j].type === 'unchanged') {
          sameTypeGroup.push(diffs[j]);
          j++;
        }
        grouped.push({
          type: 'unchanged',
          value: sameTypeGroup.map(t => t.value).join('')
        });
        i = j;
      } else {
        // עבור removed/added - אוסף את כל הרצף כבלוק replaced אחד
        const removedTokens = [];
        const addedTokens = [];
        let j = i;
        
        // אוסף את כל השינויים הרצופים (removed ו-added מעורבבים)
        while (j < diffs.length && diffs[j].type !== 'unchanged') {
          if (diffs[j].type === 'removed') {
            removedTokens.push(diffs[j].value);
          } else if (diffs[j].type === 'added') {
            addedTokens.push(diffs[j].value);
          }
          j++;
        }
        
        // יוצר בלוק לפי מה שנאסף
        if (removedTokens.length > 0 && addedTokens.length > 0) {
          // יש גם removed וגם added = החלפה (replaced)
          grouped.push({
            type: 'replaced',
            deleted: removedTokens.join(''),
            added: addedTokens.join('')
          });
        } else if (removedTokens.length > 0) {
          // רק removed
          grouped.push({
            type: 'removed',
            value: removedTokens.join('')
          });
        } else if (addedTokens.length > 0) {
          // רק added
          grouped.push({
            type: 'added',
            value: addedTokens.join('')
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