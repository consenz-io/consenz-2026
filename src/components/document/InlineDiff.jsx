import React from "react";
import { diffWords } from "diff";

const InlineDiff = ({ originalContent, newContent }) => {
  // Extract text from HTML
  const extractText = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const originalText = extractText(originalContent);
  const newText = extractText(newContent);

  // Compute differences
  const differences = diffWords(originalText, newText);

  return (
    <div className="text-slate-700 leading-relaxed prose prose-slate max-w-none">
      {differences.map((part, index) => {
        if (part.added) {
          return (
            <span
              key={index}
              className="bg-green-100 text-green-800 font-medium"
            >
              {part.value}
            </span>
          );
        }
        if (part.removed) {
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