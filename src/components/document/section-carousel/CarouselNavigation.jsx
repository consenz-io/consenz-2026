import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Carousel navigation — split into two parts:
 *  - CarouselNavigationHeader: position indicator ("Suggestion 3 of 18") / label + dot indicators (rendered at TOP)
 *  - CarouselNavigationArrows: prev/next arrows (rendered at BOTTOM of the card)
 *
 * Visual design (colors, rounded shapes, borders) preserved exactly from the original.
 */

function useNavTheme(currentView) {
  const isDeleteType = currentView?.data?.type === 'delete_section';
  const borderColorClass = isDeleteType ?
  'border-red-300 bg-gradient-to-r from-red-50 to-pink-50' :
  'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50';
  const btnClass = isDeleteType ?
  'border-red-300 bg-white text-red-600 hover:bg-red-100 hover:border-red-500 hover:shadow-md active:scale-95' :
  'border-amber-300 bg-white text-amber-700 hover:bg-amber-100 hover:border-amber-500 hover:shadow-md active:scale-95';
  return { isDeleteType, borderColorClass, btnClass };
}

/** TOP: position indicator + label + dot indicators (no arrows) */
export const CarouselNavigationHeader = React.memo(function CarouselNavigationHeader({
  allViews,
  currentIndex,
  currentView,
  isFirstView,
  sortedSuggestionsLength,
  language,
  t,
  getUserName,
  onSelectView
}) {
  const { isDeleteType } = useNavTheme(currentView);

  return (
    <div className="proposal-navigation-arrows mb-4 pb-3 border-b border-slate-200">
      {isFirstView &&
      <div className="text-center px-2 pb-2">
          <p className="text-sm">
            <span className="font-bold text-amber-700 text-lg">{sortedSuggestionsLength}</span>{' '}
            <span className="font-bold text-slate-800">{t('editSuggestions')}</span>
          </p>
        </div>
      }

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 pt-2">
        {allViews.map((view, idx) =>
        <button
          key={view.id}
          onClick={() => onSelectView(view.id)}
          className={`rounded-full transition-all duration-200 ${
          idx === currentIndex ?
          `w-5 h-2.5 ${isDeleteType ? 'bg-red-500' : 'bg-amber-500'}` :
          `w-2 h-2 ${isDeleteType ? 'bg-red-200 hover:bg-red-400' : 'bg-amber-200 hover:bg-amber-400'}`}`
          }
          aria-label={`${language === 'he' ? 'עבור לעמוד' : 'Go to'} ${idx + 1}`} />

        )}
      </div>
    </div>);

});

/** BOTTOM: prev/next arrows only */
export const CarouselNavigationArrows = React.memo(function CarouselNavigationArrows({
  currentView,
  isRTL,
  language,
  onPrev,
  onNext
}) {
  const { btnClass, isDeleteType } = useNavTheme(currentView);
  const stripBg = isDeleteType ?
  'bg-gradient-to-r from-red-50 to-pink-50 border-red-200' :
  'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200';

  return (
    <div className={`proposal-navigation-arrows mt-4 pt-3 px-3 pb-3 rounded-lg border ${stripBg}`}>
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl border-2 font-bold transition-all shadow-sm ${btnClass}`}
          aria-label={isRTL ? language === 'he' ? 'הבא' : 'التالي' : 'Previous'}>
          
          {isRTL ? <ChevronRight className="w-5 h-5 md:w-6 md:h-6" /> : <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />}
        </button>

        <span className="text-sm font-bold text-slate-600 px-2 text-center">
          {language === 'he' ? 'הצעה קודמת / הבאה' : language === 'ar' ? 'الاقتراح السابق / التالي' : 'Previous / Next suggestion'}
        </span>

        <button
          onClick={onNext}
          data-expand-proposal
          className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl border-2 font-bold transition-all shadow-sm ${btnClass}`}
          aria-label={isRTL ? language === 'he' ? 'הקודם' : 'السابق' : 'Next'}>
          
          {isRTL ? <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" /> : <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />}
        </button>
      </div>
    </div>);

});

export default CarouselNavigationHeader;