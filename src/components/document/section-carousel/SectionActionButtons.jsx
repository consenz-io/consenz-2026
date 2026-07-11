import React from "react";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

/**
 * Admin/section action buttons — suggest edit, direct edit (admin), delete (admin).
 * Extracted from SectionCarousel to reduce re-render scope.
 */
const SectionActionButtons = React.memo(function SectionActionButtons({
  isRTL,
  t,
  language,
  user,
  canParticipate,
  isAdmin,
  onEditSection,
  onDirectEdit,
  onDeleteSection,
  section,
}) {
  const handleEditClick = () => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    if (!canParticipate) return;
    onEditSection(section);
  };

  return (
    <div className={`section-action-buttons flex flex-wrap gap-1 mt-4 pt-4 border-t border-slate-200 ${isRTL ? 'justify-end' : 'justify-start'}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleEditClick}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs min-w-0"
      >
        <Edit className={`w-3.5 h-3.5 shrink-0 ${isRTL ? 'ml-1' : 'mr-1'}`} />
        <span className="truncate">{t('suggestEditSection')}</span>
      </Button>
      {isAdmin && onDirectEdit && (
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
      {isAdmin && (
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
      )}
    </div>
  );
});

export default SectionActionButtons;