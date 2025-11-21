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

  // Simple word-based diff algorithm with improved matching
  const diffWords = (oldText, newText) => {
    const oldTokens = tokenize(oldText);
    const newTokens = tokenize(newText);
    const result = [];
    
    let i = 0, j = 0;
    
    while (i < oldTokens.length || j < newTokens.length) {
      if (i >= oldTokens.length) {
        // Remaining new tokens are additions
        while (j < newTokens.length) {
          result.push({ type: 'added', value: newTokens[j] });
          j++;
        }
      } else if (j >= newTokens.length) {
        // Remaining old tokens are deletions
        while (i < oldTokens.length) {
          result.push({ type: 'removed', value: oldTokens[i] });
          i++;
        }
      } else if (oldTokens[i] === newTokens[j]) {
        // Tokens match
        result.push({ type: 'unchanged', value: oldTokens[i] });
        i++;
        j++;
      } else {
        // Look ahead to find matches within a reasonable window
        const lookAheadWindow = 10;
        let oldFoundAt = -1;
        let newFoundAt = -1;
        
        // Check if old token exists in upcoming new tokens
        for (let k = j + 1; k < Math.min(j + lookAheadWindow, newTokens.length); k++) {
          if (oldTokens[i] === newTokens[k]) {
            oldFoundAt = k;
            break;
          }
        }
        
        // Check if new token exists in upcoming old tokens
        for (let k = i + 1; k < Math.min(i + lookAheadWindow, oldTokens.length); k++) {
          if (newTokens[j] === oldTokens[k]) {
            newFoundAt = k;
            break;
          }
        }
        
        if (oldFoundAt !== -1 && (newFoundAt === -1 || (oldFoundAt - j) < (newFoundAt - i))) {
          // Old token found soon in new - mark intermediate new tokens as added
          result.push({ type: 'added', value: newTokens[j] });
          j++;
        } else if (newFoundAt !== -1) {
          // New token found soon in old - mark current old token as removed
          result.push({ type: 'removed', value: oldTokens[i] });
          i++;
        } else {
          // No match found - both changed
          result.push({ type: 'removed', value: oldTokens[i] });
          result.push({ type: 'added', value: newTokens[j] });
          i++;
          j++;
        }
      }
    }
    
    return result;
  };

  // Group consecutive changes together for better readability - כולל משפטים שלמים
  const groupChanges = (diffs) => {
    const grouped = [];
    let i = 0;
    
    while (i < diffs.length) {
      const current = diffs[i];
      
      if (current.type === 'unchanged') {
        grouped.push(current);
        i++;
      } else {
        // אסוף את כל השינויים הרצופים (מחיקות והוספות ביחד)
        const changeBlock = [];
        let j = i;
        
        while (j < diffs.length && diffs[j].type !== 'unchanged') {
          changeBlock.push(diffs[j]);
          j++;
        }
        
        // קבץ לפי סוג - קודם כל המחיקות, אחר כך כל ההוספות
        const removed = changeBlock.filter(c => c.type === 'removed');
        const added = changeBlock.filter(c => c.type === 'added');
        
        if (removed.length > 0) {
          grouped.push({
            type: 'removed',
            value: removed.map(r => r.value).join('')
          });
        }
        
        if (added.length > 0) {
          grouped.push({
            type: 'added',
            value: added.map(a => a.value).join('')
          });
        }
        
        i = j;
      }
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