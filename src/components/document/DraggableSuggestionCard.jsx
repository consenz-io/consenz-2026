import React, { useState } from "react";
import { GripVertical } from "lucide-react";
import NewSectionSuggestionCard from "./NewSectionSuggestionCard";
import { computeDropPosition } from "./utils/dropPosition";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Wraps NewSectionSuggestionCard with native HTML5 drag-and-drop for admin reordering.
 *
 * Props:
 * - suggestion: the suggestion object
 * - isAdmin: whether the current user is an admin (enables DnD)
 * - onReorder: (draggedSuggestionId, newInsertPosition) => void
 * - abovePos: numeric position of the item above this card (null if none)
 * - belowPos: numeric position of the item below this card (null if none)
 * - ...cardProps: all other props passed through to NewSectionSuggestionCard
 */
export default function DraggableSuggestionCard({
  suggestion,
  isAdmin,
  onReorder,
  abovePos,
  belowPos,
  ...cardProps
}) {
  const { isRTL, language } = useLanguage();
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverTop, setDragOverTop] = useState(false);

  const handleDragStart = (e) => {
    // Stop propagation so @hello-pangea/dnd (on the parent section Draggable) doesn't pick this up
    e.stopPropagation();
    e.dataTransfer.setData("text/plain", suggestion.id);
    e.dataTransfer.setData("text/topicid", suggestion.topicId || "");
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOverTop(e.clientY < rect.top + rect.height / 2);
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const draggedId = e.dataTransfer.getData("text/plain");
    const draggedTopicId = e.dataTransfer.getData("text/topicid");
    if (!draggedId || draggedId === suggestion.id) return;
    // Prevent cross-topic drags — insertPosition is relative to a topic's sections
    if (draggedTopicId && suggestion.topicId && draggedTopicId !== suggestion.topicId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isTopHalf = e.clientY < rect.top + rect.height / 2;
    const newPos = isTopHalf
      ? computeDropPosition(abovePos, suggestion.insertPosition ?? null)
      : computeDropPosition(suggestion.insertPosition ?? null, belowPos);
    onReorder(draggedId, newPos);
  };

  return (
    <div
      draggable={isAdmin}
      onDragStart={isAdmin ? handleDragStart : undefined}
      onDragOver={isAdmin ? handleDragOver : undefined}
      onDragLeave={isAdmin ? handleDragLeave : undefined}
      onDrop={isAdmin ? handleDrop : undefined}
      className={`relative transition-all ${isDragOver ? "ring-2 ring-blue-400" : ""} ${
        isAdmin ? "cursor-move" : ""
      }`}
    >
      {isAdmin && (
        <div
          className={`absolute top-1 ${isRTL ? "right-1" : "left-1"} z-20 p-1 bg-white/90 rounded border border-slate-300 cursor-move opacity-50 hover:opacity-100 transition-opacity`}
          title={language === 'he' ? "גרור לשינוי מיקום" : language === 'ar' ? "اسحب لإعادة التموضع" : "Drag to reposition"}
        >
          <GripVertical className="w-3 h-3 text-slate-500" />
        </div>
      )}
      {isDragOver && (
        <div
          className={`absolute ${dragOverTop ? "top-0" : "bottom-0"} left-0 right-0 h-1 bg-blue-500 rounded-full z-30 pointer-events-none`}
        />
      )}
      <NewSectionSuggestionCard suggestion={suggestion} isAdmin={isAdmin} {...cardProps} />
    </div>
  );
}