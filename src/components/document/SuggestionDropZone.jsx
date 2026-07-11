import React, { useState } from "react";
import { useLanguage } from "@/components/LanguageContext";

/**
 * A drop zone for empty slots where no suggestion cards exist.
 * Admin-only — renders nothing for non-admins.
 *
 * Props:
 * - onDrop: (draggedSuggestionId, newInsertPosition) => void
 * - getPosition: () => number  — computes the insertPosition for this slot
 * - isAdmin: boolean
 */
export default function SuggestionDropZone({ onDrop, getPosition, isAdmin }) {
  const { isRTL, language } = useLanguage();
  const [isOver, setIsOver] = useState(false);

  if (!isAdmin) return null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const draggedId = e.dataTransfer.getData("text/plain");
        if (draggedId) onDrop(draggedId, getPosition());
      }}
      className={`transition-all duration-150 rounded-lg flex items-center justify-center ${
        isOver
          ? "h-12 bg-blue-50 border-2 border-dashed border-blue-400"
          : "h-6 border border-dashed border-slate-200 bg-slate-50/50"
      }`}
    >
      {isOver && (
        <span className="text-xs text-blue-500 font-medium">
          {language === 'he' ? "שחרר כאן לשינוי מיקום" : language === 'ar' ? "أفلت هنا لإعادة التموضع" : "Drop here to reposition"}
        </span>
      )}
    </div>
  );
}