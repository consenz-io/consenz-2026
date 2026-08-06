import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * Inline suggestion title + timestamp, rendered on the same row as the
 * section number / position badge (compact, single line).
 */
const CarouselTitleInline = React.memo(function CarouselTitleInline({
  currentView,
  language,
  getUserName,
}) {
  const lang = language || 'he';
  const isDeleteType = currentView?.data?.type === 'delete_section';
  const createdDate = currentView?.data?.created_date;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-sm font-bold text-slate-800 truncate">
        {isDeleteType ? (
          lang === 'he' ? 'הצעה למחיקת הסעיף' : lang === 'ar' ? 'اقتراح لحذف القسم' : 'Delete Section Suggestion'
        ) : (
          <>
            {lang === 'he' ? 'הצעת עריכה מאת' : lang === 'ar' ? 'اقتراح تعديل بواسطة' : 'Edit suggestion by'}{' '}
            {currentView?.data?.created_by_id ? (
              <Link
                to={`${createPageUrl("Profile")}?userId=${currentView.data.created_by_id}`}
                className="text-blue-700 hover:text-blue-900 hover:underline transition-colors"
              >
                {getUserName(currentView.data.created_by_id)}
              </Link>
            ) : (
              <span>{getUserName(currentView?.data?.created_by_id)}</span>
            )}
          </>
        )}
      </span>
      {createdDate && (
        <span className="text-[10px] text-slate-400 flex-shrink-0 hidden sm:inline">
          {new Date(createdDate).toLocaleDateString(
            lang === 'he' ? 'he-IL' : lang === 'ar' ? 'ar-SA' : 'en-GB',
            { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
          )}
        </span>
      )}
    </div>
  );
});

export default CarouselTitleInline;