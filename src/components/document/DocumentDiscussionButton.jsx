import React from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "General Document Discussion" toggle button — opens the document-level
 * comments thread below the description. Styled to match CurrentVersionButton
 * so the two actions sit together as a pair beneath the description.
 */
export default function DocumentDiscussionButton({ onClick, active, count, language, isRTL, t }) {
  const label = t('documentDiscussion');

  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="sm"
      className={`group gap-2 border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 hover:border-indigo-300 text-indigo-700 ${
        active ? 'border-indigo-400 bg-indigo-100' : ''
      } ${isRTL ? "flex-row-reverse" : ""}`}
    >
      <MessageSquare className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
      <span className="font-semibold">{label}</span>
      {count > 0 && <span className="text-xs opacity-70">({count})</span>}
    </Button>
  );
}