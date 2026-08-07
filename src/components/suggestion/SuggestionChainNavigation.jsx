import React from "react";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarqueeText from "@/components/document/section-carousel/MarqueeText";

/**
 * Suggestion chain navigation — applies the marquee-based carousel design
 * (same visual language as CarouselNavigationArrows) to the edit_suggestion
 * chain shown on the SuggestionDetail page.
 *
 * Single-direction flow: one "next" button with a scrolling label, dot
 * indicators, and an optional "back to original" return button.
 */
const SuggestionChainNavigation = React.memo(function SuggestionChainNavigation({
  chain,
  currentIndex,
  isRTL,
  language,
  getUserName,
  onNavigate,
}) {
  if (!chain || chain.length <= 1) return null;

  const nextIndex = (currentIndex + 1) % chain.length;
  const nextSuggestion = chain[nextIndex];
  const isFirst = currentIndex === 0;
  const multipleEdits = chain.filter((s) => s.type === "edit_suggestion").length > 1;

  const stripBg = "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200";
  const btnClass =
    "border-amber-300 bg-white text-amber-700 hover:bg-amber-100 hover:border-amber-500 hover:shadow-md active:scale-95";

  const nextLabel = (() => {
    if (nextIndex === 0) {
      return (
        <span className="font-bold">
          {language === "he"
            ? "חזרה להצעה המקורית"
            : language === "ar"
            ? "العودة إلى الاقتراح الأصلي"
            : "Back to the original suggestion"}
        </span>
      );
    }
    const name = getUserName ? getUserName(nextSuggestion?.created_by_id) : "";
    if (language === "he") {
      return (
        <>
          <span>
            {multipleEdits ? "גם " : ""}ל{name} יש הצעת עריכה להצעה זו.{" "}
          </span>
          <span className="font-bold">לצפייה והצבעה</span>
        </>
      );
    }
    if (language === "ar") {
      return (
        <>
          <span>
            {multipleEdits ? "أيضًا " : ""}لدى {name} اقتراح تعديل على هذا
            الاقتراح.{" "}
          </span>
          <span className="font-bold">للعرض والتصويت</span>
        </>
      );
    }
    return (
      <>
        <span>
          {name} {multipleEdits ? "also " : ""}has an edit suggestion for this
          proposal.{" "}
        </span>
        <span className="font-bold">View and vote</span>
      </>
    );
  })();

  return (
    <div
      className={`proposal-navigation-arrows pt-3 px-3 pb-3 rounded-lg border ${stripBg}`}
    >
      <button
        onClick={() => onNavigate(nextSuggestion.id)}
        data-expand-proposal
        className={`w-full flex items-center gap-2 md:gap-3 px-3 py-2.5 rounded-xl border-2 text-start transition-all shadow-sm ${btnClass}`}
        aria-label={
          language === "he"
            ? "להצעה הבאה"
            : language === "ar"
            ? "الاقتراح التالي"
            : "Next suggestion"
        }
      >
        <MarqueeText
          isRTL={isRTL}
          className="flex-1 min-w-0 relative text-sm md:text-base text-slate-700"
        >
          {nextLabel}
        </MarqueeText>
        <span className="flex-shrink-0">
          {isRTL ? (
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          ) : (
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          )}
        </span>
      </button>

      {chain.length > 1 && (
        <div className="pt-3">
          <div className="flex items-center justify-center gap-1.5">
            {chain.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => onNavigate(s.id)}
                className={`rounded-full transition-all duration-200 ${
                  idx === currentIndex
                    ? "w-5 h-2.5 bg-amber-500"
                    : "w-2 h-2 bg-amber-200 hover:bg-amber-400"
                }`}
                aria-label={`${
                  language === "he" ? "עבור לעמוד" : "Go to"
                } ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {!isFirst && (
        <div className="pt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(chain[0].id)}
            className="text-xs h-8 px-3 text-slate-600 hover:text-slate-900 hover:bg-white/70"
          >
            <Undo2
              className={`w-3.5 h-3.5 shrink-0 ${isRTL ? "ml-1" : "mr-1"}`}
            />
            <span className="truncate">
              {language === "he"
                ? "חזרה להצעה המקורית"
                : language === "ar"
                ? "العودة إلى الاقتراح الأصلي"
                : "Back to original suggestion"}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
});

export default SuggestionChainNavigation;