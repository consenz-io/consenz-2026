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

  // Tokenize text - split by words and punctuation, supporting Unicode (Hebrew, Arabic, etc.)
  const tokenize = (text) => {
    // Split by whitespace and punctuation while preserving them
    // \p{L} matches any Unicode letter, \p{N} matches any Unicode number
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

  // Group consecutive changes - שומר על סדר הופעה טבעי
  const groupChanges = (diffs) => {
    const grouped = [];
    let i = 0;
    
    while (i < diffs.length) {
      const current = diffs[i];
      
      // אסוף כל ה-tokens הרצופים מאותו סוג
      const sameTypeGroup = [current];
      let j = i + 1;
      
      while (j < diffs.length && diffs[j].type === current.type) {
        sameTypeGroup.push(diffs[j]);
        j++;
      }
      
      // צרף את כל ה-tokens לטקסט אחד
      grouped.push({
        type: current.type,
        value: sameTypeGroup.map(t => t.value).join('')
      });
      
      i = j;
    }
    
    return grouped;
  };

  const differences = groupChanges(diffWords(originalText, newText));

  return (
    <div className="text-slate-700 leading-relaxed prose prose-slate max-w-none space-y-1" dir={isRTL ? 'rtl' : 'ltr'}>
      {differences.map((part, index) => {
        if (part.type === 'added') {
          return (
            <div
              key={index}
              className="bg-green-50 border-r-4 border-green-500 px-3 py-2 rounded"
            >
              <span className="text-green-800 font-medium">{part.value}</span>
            </div>
          );
        }
        if (part.type === 'removed') {
          return (
            <div
              key={index}
              className="bg-red-50 border-r-4 border-red-500 px-3 py-2 rounded"
            >
              <span className="text-red-800 line-through">{part.value}</span>
            </div>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
};

export default InlineDiff;