import React from "react";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Admin-only action buttons — direct edit, delete.
 * The "suggest edit" button now lives in CurrentSectionView (same row as Comments),
 * mirroring the SuggestionView layout.
 */
const SectionActionButtons = React.memo(function SectionActionButtons({
  isRTL,
  t,
  language,
  isAdmin,
  onDirectEdit,
  onDeleteSection,
  section,
}) {
  if (!isAdmin) return null;

  return (
    <div className={`section-action-buttons flex flex-wrap gap-1 mt-3 ${isRTL ? 'justify-end' : 'justify-start'}`}>
      {onDirectEdit && (
        <Button
          variant="default"
          size="sm"
          onClick={() => onDirectEdit(section)}
          className="bg-purple-600 hover:bg-purple-700 opacity-0 group-hover:opacity-100 transition-opacity text-xs min-w-0"
        >
          <Edit className={`w-3.5 h-3.5 shrink-0 ${isRTL ? 'ml-1' : 'mr-1'}`} />
          <span className="truncate">עריכה ישירה</span>
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onDeleteSection}
        className="text-red-700 hover:text-red-900 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity text-xs min-w-0"
        title={t('deleteSection')}
      >
        <Trash2 className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">{(language || 'he') === 'he' ? 'מחק (מנהל)' : 'Delete (Admin)'}</span>
      </Button>
    </div>
  );
});

export default SectionActionButtons;