import React from "react";
import { diffWords } from 'diff';
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

  // 1. Diff בסיסי באמצעות ספריית diff
  const rawChanges = diffWords(originalText, newText);
  
  // 2. המרה לפורמט אחיד
  const changes = rawChanges.map(change => ({
    type: change.added ? 'added' : 
          change.removed ? 'removed' : 
          'unchanged',
    value: change.value
  }));
  
  // 3. קיבוץ - אוסף כל רצף של removed/added לבלוק אחד
  const differences = [];
  let i = 0;
  
  while (i < changes.length) {
    const current = changes[i];
    
    // אם unchanged - הוסף ישירות
    if (current.type === 'unchanged') {
      differences.push(current);
      i++;
      continue;
    }
    
    // אם removed או added - אסוף את כל הרצף
    let removedParts = [];
    let addedParts = [];
    
    // אסוף כל removed ו-added עד שמגיע unchanged
    while (i < changes.length && changes[i].type !== 'unchanged') {
      if (changes[i].type === 'removed') {
        removedParts.push(changes[i].value);
      } else if (changes[i].type === 'added') {
        addedParts.push(changes[i].value);
      }
      i++;
    }
    
    // צור בלוק לפי מה שנאסף
    if (removedParts.length > 0 && addedParts.length > 0) {
      // יש גם removed וגם added = החלפה
      differences.push({
        type: 'replaced',
        deleted: removedParts.join(''),
        added: addedParts.join('')
      });
    } else if (removedParts.length > 0) {
      // רק removed
      differences.push({
        type: 'removed',
        value: removedParts.join('')
      });
    } else if (addedParts.length > 0) {
      // רק added
      differences.push({
        type: 'added',
        value: addedParts.join('')
      });
    }
  }

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