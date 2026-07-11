import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Floating suggestion navigation — appears when scrolling with pending suggestions.
 * Pure presentational, extracted from DocumentView.
 */
const FloatingSuggestionNav = React.memo(function FloatingSuggestionNav({
  pendingSuggestions,
  currentSuggestionIndex,
  isRTL,
  language,
  onPrev,
  onNext,
}) {
  if (!pendingSuggestions || pendingSuggestions.length === 0) return null;

  return (
    <nav
      className="fixed bottom-6 right-20 z-40 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 border border-slate-200"
      aria-label={language === 'he' ? 'ניווט בין הצעות' : 'Navigate between suggestions'}
    >
      <Button
        size="sm"
        variant="default"
        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-10 px-3"
        aria-label={language === 'he' ? 'הצעה קודמת' : 'Previous suggestion'}
        onClick={onPrev}
      >
        {isRTL ? <ChevronRight className="w-4 h-4" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
      </Button>
      <span className="text-sm font-medium text-slate-700 px-2" aria-live="polite" aria-atomic="true">
        {currentSuggestionIndex + 1} / {pendingSuggestions.length}
      </span>
      <Button
        size="sm"
        variant="default"
        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-10 px-3"
        aria-label={language === 'he' ? 'הצעה הבאה' : 'Next suggestion'}
        onClick={onNext}
      >
        {isRTL ? <ChevronLeft className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
      </Button>
    </nav>
  );
});

export default FloatingSuggestionNav;