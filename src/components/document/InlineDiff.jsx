import React from "react";

const InlineDiff = ({ originalContent, newContent }) => {
  // Extract text from HTML
  const extractText = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const originalText = extractText(originalContent);
  const newText = extractText(newContent);

  // Simple word-based diff algorithm
  const diffWords = (oldText, newText) => {
    const oldWords = oldText.split(/(\s+)/);
    const newWords = newText.split(/(\s+)/);
    const result = [];
    
    let i = 0, j = 0;
    
    while (i < oldWords.length || j < newWords.length) {
      if (i >= oldWords.length) {
        // Remaining new words are additions
        while (j < newWords.length) {
          result.push({ type: 'added', value: newWords[j] });
          j++;
        }
      } else if (j >= newWords.length) {
        // Remaining old words are deletions
        while (i < oldWords.length) {
          result.push({ type: 'removed', value: oldWords[i] });
          i++;
        }
      } else if (oldWords[i] === newWords[j]) {
        // Words match
        result.push({ type: 'unchanged', value: oldWords[i] });
        i++;
        j++;
      } else {
        // Check if old word exists later in new
        const oldInNew = newWords.indexOf(oldWords[i], j);
        // Check if new word exists later in old
        const newInOld = oldWords.indexOf(newWords[j], i);
        
        if (oldInNew !== -1 && (newInOld === -1 || oldInNew < newInOld)) {
          // Old word found later in new - treat current new words as additions
          result.push({ type: 'added', value: newWords[j] });
          j++;
        } else if (newInOld !== -1) {
          // New word found later in old - treat current old word as deletion
          result.push({ type: 'removed', value: oldWords[i] });
          i++;
        } else {
          // Neither found - treat old as removed and new as added
          result.push({ type: 'removed', value: oldWords[i] });
          result.push({ type: 'added', value: newWords[j] });
          i++;
          j++;
        }
      }
    }
    
    return result;
  };

  const differences = diffWords(originalText, newText);

  return (
    <div className="text-slate-700 leading-relaxed prose prose-slate max-w-none">
      {differences.map((part, index) => {
        if (part.type === 'added') {
          return (
            <span
              key={index}
              className="bg-green-100 text-green-800 font-medium"
            >
              {part.value}
            </span>
          );
        }
        if (part.type === 'removed') {
          return (
            <span
              key={index}
              className="bg-red-100 text-red-800 line-through"
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