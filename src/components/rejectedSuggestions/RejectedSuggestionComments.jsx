import React from "react";
import { MessageSquare } from "lucide-react";

const LABELS = {
  he: { title: "תגובות", more: "עוד {count} תגובות" },
  ar: { title: "التعليقات", more: "{count} تعليقات إضافية" },
  en: { title: "Comments", more: "{count} more comments" },
};

/**
 * Compact comments preview inside a rejected-suggestion card: total count plus
 * the two most recent comments, in the same visual language as the rest of the
 * platform's suggestion cards.
 */
export default function RejectedSuggestionComments({ comments, language }) {
  const labels = LABELS[language] || LABELS.en;
  if (!comments || comments.length === 0) return null;

  const visible = comments.slice(0, 2);
  const remaining = comments.length - visible.length;

  return (
    <div className="border-t border-slate-100 pt-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <MessageSquare className="w-4 h-4" />
        <span>{labels.title} ({comments.length})</span>
      </div>
      <ul className="space-y-1.5">
        {visible.map((comment) => (
          <li key={comment.id} className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded px-2 py-1.5">
            <span className="font-medium text-slate-700">{comment.authorName}</span>
            <span className="mx-1 text-slate-400">·</span>
            <span className="truncate">{comment.content}</span>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <p className="text-xs text-slate-400">{labels.more.replace("{count}", remaining)}</p>
      )}
    </div>
  );
}