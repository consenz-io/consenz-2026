import React from "react";
import { Card } from "@/components/ui/card";

export default function SectionDiff({ originalContent, newContent }) {
  // Simple word-level diff highlighting
  const getContentWords = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent.split(/\s+/);
  };

  const originalWords = getContentWords(originalContent);
  const newWords = getContentWords(newContent);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-4 bg-red-50 border-red-200">
        <div className="text-sm font-semibold text-red-700 mb-2">Original</div>
        <div 
          className="prose prose-sm max-w-none text-slate-700"
          dangerouslySetInnerHTML={{ __html: originalContent }}
        />
      </Card>
      <Card className="p-4 bg-green-50 border-green-200">
        <div className="text-sm font-semibold text-green-700 mb-2">Proposed</div>
        <div 
          className="prose prose-sm max-w-none text-slate-700"
          dangerouslySetInnerHTML={{ __html: newContent }}
        />
      </Card>
    </div>
  );
}