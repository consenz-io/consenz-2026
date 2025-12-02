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

  // Character-level diff using LCS algorithm for block-based display
  const computeCharDiff = (oldText, newText) => {
    const oldChars = oldText.split('');
    const newChars = newText.split('');
    
    const m = oldChars.length;
    const n = newChars.length;
    
    // Build LCS table
    const lcs = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldChars[i - 1] === newChars[j - 1]) {
          lcs[i][j] = lcs[i - 1][j - 1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
        }
      }
    }
    
    // Backtrack to find character-level diff
    const charDiff = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
        charDiff.unshift({ type: 'unchanged', char: oldChars[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
        charDiff.unshift({ type: 'added', char: newChars[j - 1] });
        j--;
      } else if (i > 0) {
        charDiff.unshift({ type: 'removed', char: oldChars[i - 1] });
        i--;
      }
    }
    
    // Group consecutive characters of the same type into blocks
    const result = [];
    let currentType = null;
    let currentText = '';
    
    for (const item of charDiff) {
      if (item.type === currentType) {
        currentText += item.char;
      } else {
        if (currentText) {
          result.push({ type: currentType, value: currentText });
        }
        currentType = item.type;
        currentText = item.char;
      }
    }
    
    if (currentText) {
      result.push({ type: currentType, value: currentText });
    }
    
    return result;
  };

  const differences = computeCharDiff(originalText, newText)

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
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
};

export default InlineDiff;