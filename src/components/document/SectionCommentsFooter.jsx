import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import CommentsSection from "./CommentsSection";

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
  const { data: suggestionComments = [] } = useQuery({
    queryKey: ["suggestionComments", group.suggestionId],
    queryFn: () =>
      base44.entities.Comment.filter({
        rootEntityType: "suggestion",
        rootEntityId: group.suggestionId,
      }),
    enabled: !!group.suggestionId,
    initialData: [],
  });

  const commentCount = group.suggestionId ? suggestionComments.length : sectionComments.length;

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
            entityType={group.suggestionId ? "suggestion" : "section"}
            entityId={group.suggestionId || sectionId}
            user={user}
          />
        </div>
      )}
    </div>
  );
}