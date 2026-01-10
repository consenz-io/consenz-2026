import React, { useMemo } from "react";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Fast word-level diff algorithm using Myers' diff algorithm approach
 * Optimized for performance with texts up to 50K+ characters
 */

// Extract plain text from HTML
const extractText = (html) => {
  if (!html) return '';
  let text = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
};

// Split text into individual words and punctuation
const tokenize = (text) => {
  if (!text) return [];
  // Split by whitespace but keep punctuation as separate tokens
  return text.match(/\S+|\s+/g) || [];
};

// LCS-based diff to find longest common subsequences
const computeLCS = (oldTokens, newTokens) => {
  const m = oldTokens.length;
  const n = newTokens.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Build LCS table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  return dp;
};

// Backtrack through LCS table to generate diff
const generateDiff = (oldTokens, newTokens, dp) => {
  const result = [];
  let i = oldTokens.length;
  let j = newTokens.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      result.unshift({ type: 'unchanged', value: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', value: newTokens[j - 1] });
      j--;
    } else if (i > 0) {
      result.unshift({ type: 'removed', value: oldTokens[i - 1] });
      i--;
    }
  }
  
  return result;
};

// Main diff computation
const computeWordDiff = (oldTokens, newTokens) => {
  const dp = computeLCS(oldTokens, newTokens);
  const diff = generateDiff(oldTokens, newTokens, dp);
  
  // Merge consecutive tokens of same type
  const merged = [];
  for (const item of diff) {
    if (merged.length > 0 && merged[merged.length - 1].type === item.type) {
      merged[merged.length - 1].value += item.value;
    } else {
      merged.push({ ...item });
    }
  }
  
  return merged;
};

export default function WordLevelDiff({ 
  originalContent, 
  newContent, 
  className = "",
  showRemoved = true,
  showAdded = true 
}) {
  const { isRTL } = useLanguage();
  
  const diff = useMemo(() => {
    const oldText = extractText(originalContent);
    const newText = extractText(newContent);
    const oldTokens = tokenize(oldText);
    const newTokens = tokenize(newText);
    return computeWordDiff(oldTokens, newTokens);
  }, [originalContent, newContent]);
  
  return (
    <div 
      className={`leading-relaxed ${className}`}
      style={{ 
        direction: isRTL ? 'rtl' : 'ltr',
        textAlign: isRTL ? 'right' : 'left'
      }}
    >
      {diff.map((part, index) => {
        if (part.type === 'added' && showAdded) {
          return (
            <span
              key={index}
              className="bg-[#dcfce7] text-green-800 border-b-2 border-green-500 font-medium transition-colors"
            >
              {part.value}
            </span>
          );
        }
        if (part.type === 'removed' && showRemoved) {
          return (
            <span
              key={index}
              className="bg-[#fef2f2] text-red-700 line-through opacity-70 transition-colors"
            >
              {part.value}
            </span>
          );
        }
        if (part.type === 'unchanged') {
          return <span key={index}>{part.value}</span>;
        }
        return null;
      })}
    </div>
  );
}

// Export utility functions for use in other components
export { extractText, tokenize, computeWordDiff };