import React from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import CommentsSection from "./CommentsSection";

// SectionCommentsFooter renders ONLY for non-suggestion versions (direct_edit, section_created).
// For suggestion_accepted versions, SuggestionMeta owns the comment button/thread.
export default function SectionCommentsFooter({
  group,
  sectionId,
  sectionComments,
  showSectionComments,
  setShowSectionComments,
  user,
  isRTL,
  t,
}) {
  // If this version came from a suggestion, SuggestionMeta handles comments — render nothing here.
  if (group.suggestionId) return null;

  const commentCount = sectionComments.length;

  return (
    <div className={`px-3 pb-3 pt-2 border-t border-teal-100 flex items-center justify-end flex-wrap gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowSectionComments((v) => !v)}
        className="h-7 text-xs text-slate-500 hover:text-blue-600 px-2"
      >
        <MessageSquare className={`w-3 h-3 ${isRTL ? "ml-1" : "mr-1"}`} />
        {t("comments")} ({commentCount})
      </Button>
      {showSectionComments && (
        <div className="w-full mt-2 pt-2 border-t border-teal-200">
          <CommentsSection
            entityType="section"
            entityId={sectionId}
            user={user}
          />
        </div>
      )}
    </div>
  );
}