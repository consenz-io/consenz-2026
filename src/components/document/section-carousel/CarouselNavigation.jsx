import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Carousel navigation bar — prev/next arrows, current view label, and dot indicators.
 * Extracted from SectionCarousel to reduce re-render scope when navigating between views.
 */
const CarouselNavigation = React.memo(function CarouselNavigation({
  allViews,
  currentIndex,
  currentView,
  isFirstView,
  sortedSuggestionsLength,
  isRTL,
  language,
  t,
  getUserName,
  onPrev,
  onNext,
  onSelectView,
}) {
  const isDeleteType = currentView?.data?.type === 'delete_section';

  const borderColorClass = isDeleteType
    ? 'border-red-300 bg-gradient-to-r from-red-50 to-pink-50'
    : 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50';

  const btnClass = isDeleteType
    ? 'border-red-300 bg-white text-red-600 hover:bg-red-100 hover:border-red-500 hover:shadow-md active:scale-95'
    : 'border-amber-300 bg-white text-amber-700 hover:bg-amber-100 hover:border-amber-500 hover:shadow-md active:scale-95';

  return (
    <div className={`proposal-navigation-arrows mb-4 border-b-2 p-3 rounded-lg shadow-sm ${borderColorClass}`}>
      <div className="flex items-center justify-between pb-2">
        <button
          onClick={onPrev}
          className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl border-2 font-bold transition-all shadow-sm ${btnClass}`}
          aria-label={isRTL ? (language === 'he' ? 'הבא' : 'التالي') : 'Previous'}
        >
          {isRTL ? <ChevronRight className="w-5 h-5 md:w-6 md:h-6" /> : <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />}
        </button>

        <div className="text-center flex-1 px-2">
          {isFirstView ? (
            <p className="text-sm">
              <span className="font-bold text-amber-700 text-lg">{sortedSuggestionsLength}</span>{' '}
              <span className="font-bold text-slate-800">{t('editSuggestions')}</span>
            </p>
          ) : (
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => onSelectView('current')}
                className={`text-sm font-bold hover:underline cursor-pointer transition-colors ${
                  isDeleteType ? 'text-red-700 hover:text-red-900' : 'text-blue-700 hover:text-blue-900'
                }`}
              >
                {isDeleteType
                  ? ((language || 'he') === 'he' ? 'הצעה למחיקת הסעיף' : (language || 'he') === 'ar' ? 'اقتراح لحذف القسم' : 'Delete Section Suggestion')
                  : `${(language || 'he') === 'he' ? 'הצעת עריכה מאת' : (language || 'he') === 'ar' ? 'اقتراح תعديل بواסطة' : 'Edit suggestion by'} ${getUserName(currentView?.data?.created_by_id)}`}
              </button>
              {currentView?.data?.created_date && (
                <span className="text-[10px] text-slate-400">
                  {new Date(currentView.data.created_date).toLocaleDateString(
                    language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB',
                    { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
                  )}
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onNext}
          data-expand-proposal
          className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl border-2 font-bold transition-all shadow-sm ${btnClass}`}
          aria-label={isRTL ? (language === 'he' ? 'הקודם' : 'السابق') : 'Next'}
        >
          {isRTL ? <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" /> : <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />}
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 pt-2">
        {allViews.map((view, idx) => (
          <button
            key={view.id}
            onClick={() => onSelectView(view.id)}
            className={`rounded-full transition-all duration-200 ${
              idx === currentIndex
                ? `w-5 h-2.5 ${isDeleteType ? 'bg-red-500' : 'bg-amber-500'}`
                : `w-2 h-2 ${isDeleteType ? 'bg-red-200 hover:bg-red-400' : 'bg-amber-200 hover:bg-amber-400'}`
            }`}
            aria-label={`${language === 'he' ? 'עבור לעמוד' : 'Go to'} ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
});

export default CarouselNavigation;