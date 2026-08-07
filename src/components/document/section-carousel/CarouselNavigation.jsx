import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarqueeText from "./MarqueeText";

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
  if (!isFirstView) return null;

  return (
    <div className="proposal-navigation-arrows mb-4 pb-3 border-b border-slate-200">
      <div className="text-center px-2">
        <p className="text-sm">
          <span className="font-bold text-amber-700 text-lg">{sortedSuggestionsLength}</span>{' '}
          <span className="font-bold text-slate-800">{t('editSuggestions')}</span>
        </p>
      </div>
    </div>);

});

/** Dot indicators — moved to the bottom arrows strip */
export const CarouselNavigationDots = React.memo(function CarouselNavigationDots({
  allViews,
  currentIndex,
  currentView,
  language,
  onSelectView
}) {
  const { isDeleteType } = useNavTheme(currentView);
  return (
    <div className="flex items-center justify-center gap-1.5">
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
    </div>);

});

/** BOTTOM: prev/next arrows only */
export const CarouselNavigationArrows = React.memo(function CarouselNavigationArrows({
  currentView,
  isRTL,
  language,
  onPrev,
  onNext,
  allViews,
  currentIndex,
  onSelectView,
  onReturnToCurrent,
  isOnCurrentView,
  getUserName,
  t
}) {
  const { btnClass, isDeleteType } = useNavTheme(currentView);
  const stripBg = isDeleteType ?
  'bg-gradient-to-r from-red-50 to-pink-50 border-red-200' :
  'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200';

  const nextView = allViews && allViews.length > 0 ?
  allViews[(currentIndex + 1) % allViews.length] :
  null;

  const nextLabel = (() => {
    if (!nextView) return null;
    if (nextView.type === 'current') {
      return (
        <span className="font-bold">
          {language === 'he' ? 'חזרה לנוסח הסעיף הנוכחי' : language === 'ar' ? 'العودة إلى صيغة البند الحالية' : 'Back to the current section wording'}
        </span>);

    }
    const name = getUserName ? getUserName(nextView.data?.created_by_id) : '';
    const multiple = allViews.filter((v) => v.type !== 'current').length > 1;
    const isEditSuggestion = nextView.data?.type === 'edit_suggestion';
    if (isEditSuggestion) {
      if (language === 'he') {
        return (
          <>
            <span>{multiple ? 'גם ' : ''}ל{name} יש הצעת עריכה להצעה זו. </span>
            <span className="font-bold">לצפייה והצבעה</span>
          </>);
      }
      if (language === 'ar') {
        return (
          <>
            <span>{multiple ? 'أيضًا ' : ''}لدى {name} اقتراح تعديل على هذا الاقتراح. </span>
            <span className="font-bold">للعرض والتصويت</span>
          </>);
      }
      return (
        <>
          <span>{name} {multiple ? 'also ' : ''}has an edit suggestion for this proposal. </span>
          <span className="font-bold">View and vote</span>
        </>);
    }
    if (language === 'he') {
      return (
        <>
          <span>{multiple ? 'גם ' : ''}ל{name} יש הצעה לשיפור הסעיף. </span>
          <span className="font-bold">לצפייה והצבעה</span>
        </>);

    }
    if (language === 'ar') {
      return (
        <>
          <span>{multiple ? 'أيضًا ' : ''}لدى {name} اقتراح لتحسين البند. </span>
          <span className="font-bold">للعرض والتصويت</span>
        </>);

    }
    return (
      <>
        <span>{name} {multiple ? 'also ' : ''}has a suggestion to improve this section. </span>
        <span className="font-bold">View and vote</span>
      </>);

  })();

  return (
    <div className={`proposal-navigation-arrows mt-4 pt-3 px-3 pb-3 rounded-lg border ${stripBg}`}>
      <button
        onClick={onNext}
        data-expand-proposal
        className={`w-full flex items-center gap-2 md:gap-3 px-3 py-2.5 rounded-xl border-2 text-start transition-all shadow-sm ${btnClass}`}
        aria-label={language === 'he' ? 'להצעה הבאה' : language === 'ar' ? 'الاقتراح التالي' : 'Next suggestion'}>

        <MarqueeText isRTL={isRTL} className="flex-1 min-w-0 relative text-sm md:text-base text-slate-700">
          {nextLabel}
        </MarqueeText>
        <span className="flex-shrink-0">
          {isRTL ? <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" /> : <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />}
        </span>
      </button>

      {allViews && allViews.length > 1 &&
      <div className="pt-3">
          <CarouselNavigationDots
          allViews={allViews}
          currentIndex={currentIndex}
          currentView={currentView}
          language={language}
          onSelectView={onSelectView} />

        </div>
      }

      {onReturnToCurrent && !isOnCurrentView &&
      <div className="pt-3 flex justify-center">
          <Button
          variant="ghost"
          size="sm"
          onClick={onReturnToCurrent}
          className="text-xs h-8 px-3 text-slate-600 hover:text-slate-900 hover:bg-white/70">

            <Undo2 className={`w-3.5 h-3.5 shrink-0 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            <span className="truncate">{t('returnToCurrentVersion')}</span>
          </Button>
        </div>
      }
    </div>);

});

export default CarouselNavigationHeader;