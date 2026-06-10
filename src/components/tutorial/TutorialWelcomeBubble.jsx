import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const strings = {
  he: {
    headline: 'סיור בפלטפורמה',
    body: 'רוצים ללמוד איך הפלטפורמה עובדת? קחו סיור קצר של כמה שניות.',
    start: 'בואו נתחיל',
  },
  ar: {
    headline: 'جولة على المنصة',
    body: 'هل تريدون تعلّم كيفية عمل المنصة؟ خذوا جولة قصيرة تستغرق ثوانٍ.',
    start: 'لننبدأ',
  },
  en: {
    headline: 'Platform Tour',
    body: 'Want to learn how the platform works? Take a quick tour in just a few seconds.',
    start: 'Let\'s go',
  },
};

const TOOLTIP_WIDTH = 280;
const ARROW_SIZE = 10;

export default function TutorialWelcomeBubble({ onStart, onSkip, isRTL, language = 'he', delay = 10000 }) {
  const lang = strings[language] || strings.he;
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState(null);
  const tooltipRef = useRef(null);

  // Show after delay (0 for immediate, 15000 for auto-start)
  useEffect(() => {
    if (delay === 0) {
      setShow(true);
    } else {
      const timer = setTimeout(() => setShow(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  // Position tooltip relative to TutorialRestartButton
  useEffect(() => {
    if (!show) return;

    function updatePosition() {
      const btn = document.querySelector('[data-tutorial-restart-btn]');
      if (!btn) {
        setPos({ left: 16, top: 100 });
        return;
      }

      const rect = btn.getBoundingClientRect();
      const left = isRTL 
        ? rect.left - TOOLTIP_WIDTH - ARROW_SIZE - 8
        : rect.right + ARROW_SIZE + 8;
      const top = rect.top + rect.height / 2 - 60;

      setPos({ left: Math.max(8, left), top: Math.max(8, top) });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition, { passive: true });
    return () => window.removeEventListener('resize', updatePosition);
  }, [show, isRTL]);

  if (!show || !pos) return null;

  const handleStart = () => {
    setShow(false);
    onStart();
  };

  const handleSkip = () => {
    setShow(false);
    onSkip();
  };

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[10002] bg-white rounded-xl shadow-2xl border border-slate-200 p-4"
      style={{ width: TOOLTIP_WIDTH, ...pos }}
      dir={isRTL ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="false"
      aria-label={lang.headline}
    >
      {/* Arrow pointing toward sidebar */}
      <div
        className="absolute w-0 h-0 border-solid"
        style={{
          [isRTL ? 'right' : 'left']: -10,
          top: '50%',
          transform: 'translateY(-50%)',
          borderTop: '10px solid transparent',
          borderBottom: '10px solid transparent',
          [isRTL ? 'borderLeft' : 'borderRight']: '10px solid white',
        }}
      />

      {/* Close button */}
      <button
        onClick={handleSkip}
        className="absolute top-2 end-2 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label={isRTL ? 'סגור' : 'Close'}
      >
        <X className="w-4 h-4" />
      </button>

      {/* Content */}
      <h3 className="font-bold text-slate-900 text-base mb-1">{lang.headline}</h3>
      <p className="text-sm text-slate-600 mb-3 leading-relaxed">{lang.body}</p>

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="flex-1 text-slate-500"
        >
          {isRTL ? 'דלגו' : 'Skip'}
        </Button>
        <Button
          size="sm"
          onClick={handleStart}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {lang.start}
        </Button>
      </div>
    </div>
  );
}