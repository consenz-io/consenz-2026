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

// Tokenize text into words, treating punctuation as separate tokens
const tokenize = (text) => {
  if (!text) return [];
  const tokens = [];
  // Match: word characters OR punctuation OR whitespace
  // Punctuation is treated as separate tokens
  const regex = /([א-תa-zA-Z0-9]+|[.,;:!?()״״׳׳""''\-–—]|\s+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
};

// Fast diff using hash-based comparison (Myers-like approach)
const computeWordDiff = (oldTokens, newTokens) => {
  const result = [];
  
  // Build hash map for old tokens positions
  const oldMap = new Map();
  oldTokens.forEach((token, idx) => {
    if (!oldMap.has(token)) oldMap.set(token, []);
    oldMap.get(token).push(idx);
  });
  
  let oldIdx = 0;
  let newIdx = 0;
  
  while (newIdx < newTokens.length || oldIdx < oldTokens.length) {
    // If we've exhausted old tokens, rest are additions
    if (oldIdx >= oldTokens.length) {
      result.push({ type: 'added', value: newTokens[newIdx] });
      newIdx++;
      continue;
    }
    
    // If we've exhausted new tokens, rest are removals
    if (newIdx >= newTokens.length) {
      result.push({ type: 'removed', value: oldTokens[oldIdx] });
      oldIdx++;
      continue;
    }
    
    // Exact match
    if (oldTokens[oldIdx] === newTokens[newIdx]) {
      result.push({ type: 'unchanged', value: oldTokens[oldIdx] });
      oldIdx++;
      newIdx++;
      continue;
    }
    
    // Look ahead to find best match
    const lookAhead = Math.min(10, Math.max(newTokens.length - newIdx, oldTokens.length - oldIdx));
    let foundMatch = false;
    
    // Check if current new token exists later in old
    for (let i = 1; i <= lookAhead && !foundMatch; i++) {
      if (oldIdx + i < oldTokens.length && oldTokens[oldIdx + i] === newTokens[newIdx]) {
        // Old tokens before match are removed
        for (let j = 0; j < i; j++) {
          result.push({ type: 'removed', value: oldTokens[oldIdx + j] });
        }
        oldIdx += i;
        foundMatch = true;
      }
    }
    
    if (!foundMatch) {
      // Check if current old token exists later in new
      for (let i = 1; i <= lookAhead && !foundMatch; i++) {
        if (newIdx + i < newTokens.length && newTokens[newIdx + i] === oldTokens[oldIdx]) {
          // New tokens before match are added
          for (let j = 0; j < i; j++) {
            result.push({ type: 'added', value: newTokens[newIdx + j] });
          }
          newIdx += i;
          foundMatch = true;
        }
      }
    }
    
    // No match found - mark as change
    if (!foundMatch) {
      result.push({ type: 'removed', value: oldTokens[oldIdx] });
      result.push({ type: 'added', value: newTokens[newIdx] });
      oldIdx++;
      newIdx++;
    }
  }
  
  // Merge consecutive same-type tokens
  const merged = [];
  for (const item of result) {
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