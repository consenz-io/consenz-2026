import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { parseUserDate } from "@/components/utils/dateFormatter";

/**
 * Shared proposal-card header line: proposal type + proposer + timestamp.
 * Used by both the edit-section proposal card (SectionCarousel) and the
 * new-section proposal card, so both headers read identically.
 * The proposer's name wraps instead of truncating, so it stays fully
 * visible on mobile.
 */
const CarouselTitleInline = React.memo(function CarouselTitleInline({
  currentView,
  language,
  getUserName,
}) {
  const lang = language || 'he';
  const data = currentView?.data;
  const type = data?.type;
  const createdDate = data?.created_date;

  const label =
    type === 'delete_section'
      ? lang === 'he' ? 'הצעה למחיקת הסעיף' : lang === 'ar' ? 'اقتراح لحذف القسم' : 'Delete Section Suggestion'
      : type === 'new_section'
        ? lang === 'he' ? 'הצעה לסעיף חדש מאת' : lang === 'ar' ? 'اقتراح قسم جديد بواسطة' : 'New section suggestion by'
        : lang === 'he' ? 'הצעת עריכה מאת' : lang === 'ar' ? 'اقتراح تعديل بواسطة' : 'Edit suggestion by';

  const isDeleteType = type === 'delete_section';

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
      <span className="text-sm font-bold text-slate-800 break-words min-w-0">
        {isDeleteType ? (
          label
        ) : (
          <>
            {label}{' '}
            {data?.created_by_id ? (
              <Link
                to={`${createPageUrl("Profile")}?userId=${data.created_by_id}`}
                className="text-blue-700 hover:text-blue-900 hover:underline transition-colors"
              >
                {getUserName(data.created_by_id)}
              </Link>
            ) : (
              <span>{getUserName(data?.created_by_id)}</span>
            )}
          </>
        )}
      </span>
      {createdDate && (
        <span className="text-[10px] text-slate-400">
          {parseUserDate(createdDate).toLocaleDateString(
            lang === 'he' ? 'he-IL' : lang === 'ar' ? 'ar-SA' : 'en-GB',
            { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
          )}
        </span>
      )}
    </div>
  );
});

export default CarouselTitleInline;