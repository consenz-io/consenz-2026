import React from "react";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/components/LanguageContext";

export default function SectionDiff({ originalContent, newContent }) {
  const { t } = useLanguage();
  const getTextContent = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || '';
  };

  const originalText = getTextContent(originalContent);
  const newText = getTextContent(newContent);

  const computeDiff = () => {
    const originalWords = originalText.split(/(\s+)/);
    const newWords = newText.split(/(\s+)/);
    
    const result = [];
    let i = 0, j = 0;

    while (i < originalWords.length || j < newWords.length) {
      if (i >= originalWords.length) {
        result.push({ type: 'added', text: newWords.slice(j).join('') });
        break;
      }
      if (j >= newWords.length) {
        result.push({ type: 'removed', text: originalWords.slice(i).join('') });
        break;
      }

      if (originalWords[i] === newWords[j]) {
        result.push({ type: 'unchanged', text: originalWords[i] });
        i++;
        j++;
      } else {
        let foundMatch = false;
        for (let k = j + 1; k < Math.min(j + 10, newWords.length); k++) {
          if (originalWords[i] === newWords[k]) {
            result.push({ type: 'added', text: newWords.slice(j, k).join('') });
            j = k;
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) {
          for (let k = i + 1; k < Math.min(i + 10, originalWords.length); k++) {
            if (newWords[j] === originalWords[k]) {
              result.push({ type: 'removed', text: originalWords.slice(i, k).join('') });
              i = k;
              foundMatch = true;
              break;
            }
          }
        }
        if (!foundMatch) {
          result.push({ type: 'removed', text: originalWords[i] });
          result.push({ type: 'added', text: newWords[j] });
          i++;
          j++;
        }
      }
    }

    return result;
  };

  const diff = computeDiff();

  const { isRTL } = useLanguage();
  return (
    <Card className="p-4 bg-slate-50 border-slate-200">
      <div className="text-sm font-semibold text-slate-700 mb-3">{t('proposedChanges')}</div>
      <div 
        className="prose prose-sm max-w-none" 
        style={{ 
          direction: isRTL ? 'rtl' : 'ltr', 
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: "'Amiri', 'Noto Serif Hebrew', 'Noto Serif', Georgia, serif",
          fontSize: "1.125rem",
          lineHeight: "1.8",
          letterSpacing: "0.01em"
        }}
      >
        {diff.map((part, idx) => {
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
        })}
      </div>
    </Card>
  );
}