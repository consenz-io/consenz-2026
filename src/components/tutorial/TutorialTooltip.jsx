import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, UserPlus } from 'lucide-react';
import { tTutorial } from './tutorialSteps';
import { useLanguage } from '@/components/LanguageContext';
import { base44 } from '@/api/base44Client';

const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT = 200; // estimate for positioning
const ARROW_SIZE = 10;

function computePosition(rect, preferred, isRTL) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 16;

  const fits = {
    top: rect.top - TOOLTIP_HEIGHT - ARROW_SIZE - margin > 0,
    bottom: rect.bottom + TOOLTIP_HEIGHT + ARROW_SIZE + margin < vh,
    left: rect.left - TOOLTIP_WIDTH - ARROW_SIZE - margin > 0,
    right: rect.right + TOOLTIP_WIDTH + ARROW_SIZE + margin < vw,
  };

  if (preferred !== 'auto' && fits[preferred]) return preferred;

  // Auto-flip priority
  const priority = isRTL ? ['bottom', 'top', 'right', 'left'] : ['bottom', 'top', 'right', 'left'];
  return priority.find(p => fits[p]) || 'bottom';
}

function getTooltipStyle(rect, position) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  switch (position) {
    case 'top':
      return {
        left: Math.max(8, Math.min(window.innerWidth - TOOLTIP_WIDTH - 8, centerX - TOOLTIP_WIDTH / 2)),
        top: rect.top - ARROW_SIZE - 8,
        transform: 'translateY(-100%)',
      };
    case 'bottom':
      return {
        left: Math.max(8, Math.min(window.innerWidth - TOOLTIP_WIDTH - 8, centerX - TOOLTIP_WIDTH / 2)),
        top: rect.bottom + ARROW_SIZE + 8,
      };
    case 'left':
      return {
        left: rect.left - ARROW_SIZE - 8,
        top: Math.max(8, centerY - TOOLTIP_HEIGHT / 2),
        transform: 'translateX(-100%)',
      };
    case 'right':
      return {
        left: rect.right + ARROW_SIZE + 8,
        top: Math.max(8, centerY - TOOLTIP_HEIGHT / 2),
      };
    default:
      return { left: centerX - TOOLTIP_WIDTH / 2, top: rect.bottom + ARROW_SIZE + 8 };
  }
}

function ArrowEl({ position, isRTL }) {
  const base = 'absolute w-0 h-0 border-solid';
  const styles = {
    top: {
      className: `${base} border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-b-transparent border-t-white`,
      style: { bottom: -10, left: '50%', transform: 'translateX(-50%)' },
    },
    bottom: {
      className: `${base} border-l-[10px] border-r-[10px] border-b-[10px] border-l-transparent border-r-transparent border-t-transparent border-b-white`,
      style: { top: -10, left: '50%', transform: 'translateX(-50%)' },
    },
    left: {
      className: `${base} border-t-[10px] border-b-[10px] border-l-[10px] border-t-transparent border-b-transparent border-r-transparent border-l-white`,
      style: { right: -10, top: '50%', transform: 'translateY(-50%)' },
    },
    right: {
      className: `${base} border-t-[10px] border-b-[10px] border-r-[10px] border-t-transparent border-b-transparent border-l-transparent border-r-white`,
      style: { left: -10, top: '50%', transform: 'translateY(-50%)' },
    },
  };
  const s = styles[position] || styles.bottom;
  return <div className={s.className} style={s.style} />;
}

export default function TutorialTooltip({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onBack,
  onSkip,
  practiceCompleted,
  showSuccess,
  showSignupPrompt,
  isAuthenticated,
  isRTL,
}) {
  const { language } = useLanguage();
  const heading = tTutorial(step.heading, language);
  const body = tTutorial(step.body, language);
  const successMessage = tTutorial(step.successMessage, language);

  const [pos, setPos] = useState(null);
  const [resolvedPosition, setResolvedPosition] = useState('bottom');
  const [showConfirm, setShowConfirm] = useState(false);
  const tooltipRef = useRef(null);

  useEffect(() => {
    function update() {
      const el = document.querySelector(step.targetSelector);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const rp = computePosition(rect, step.tooltipPosition, isRTL);
      setResolvedPosition(rp);
      setPos(getTooltipStyle(rect, rp));
    }

    // Scroll the target element into view first, then update position
    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      // Re-compute position after scroll settles
      const timer = setTimeout(update, 400);
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
      };
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [step, isRTL]);

  if (!pos) return null;

  const isPractice = step.type === 'practice';
  const nextDisabled = isPractice && !practiceCompleted;

  return (
    <>
    {/* Confirm skip dialog */}
    {showConfirm && (
      <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-6 flex flex-col gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <p className="text-slate-800 font-semibold text-center text-base">
            {isRTL ? 'לסיים את הסיור?' : 'Exit the tour?'}
          </p>
          <p className="text-slate-500 text-sm text-center">
            {isRTL ? 'תמיד אפשר להתחיל אותו מחדש מתפריט הניווט.' : 'You can always restart it from the navigation menu.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>
              {isRTL ? 'המשך סיור' : 'Continue'}
            </Button>
            <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={() => { setShowConfirm(false); onSkip(); }}>
              {isRTL ? 'סיים' : 'Exit'}
            </Button>
          </div>
        </div>
      </div>
    )}

    <div
      ref={tooltipRef}
      className="fixed z-[10002] bg-white rounded-xl shadow-2xl border border-slate-200 p-4"
      style={{ width: TOOLTIP_WIDTH, ...pos }}
      dir={isRTL ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="false"
      aria-label={step.heading}
    >
      {/* Close button */}
      <button
        onClick={() => setShowConfirm(true)}
        className="absolute top-2 end-2 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label={isRTL ? 'סגור' : 'Close'}
      >
        <X className="w-4 h-4" />
      </button>
      <ArrowEl position={resolvedPosition} isRTL={isRTL} />

      {/* Success state */}
      {showSuccess && successMessage ? (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <CheckCircle className="w-10 h-10 text-green-500" />
          <p className="font-semibold text-green-700">{successMessage}</p>
        </div>
      ) : showSignupPrompt ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <UserPlus className="w-9 h-9 text-blue-500" />
          <h3 className="font-bold text-slate-900 text-base">{tTutorial('signup.prompt.heading', language)}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{tTutorial('signup.prompt.body', language)}</p>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => base44.auth.redirectToLogin(window.location.href)}
          >
            {tTutorial('signup.prompt.cta', language)}
          </Button>
        </div>
      ) : (
        <>
          {/* Heading */}
          <h3 className="font-bold text-slate-900 text-base mb-1">{heading}</h3>

          {/* Body */}
          {body && <p className="text-sm text-slate-600 mb-3 leading-relaxed">{body}</p>}

          {/* Points table */}
          {step.table && step.table.length > 0 && (
            <table className="w-full text-xs mb-3 border-collapse">
              <tbody>
                {step.table.map((row, i) => {
                  const isCost = row.value.startsWith('−') || row.value.startsWith('-');
                  return (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-1 text-slate-600 text-start">{tTutorial(row.label, language)}</td>
                      <td className={`py-1 font-bold text-end ${isCost ? 'text-red-600' : 'text-green-600'}`}>
                        {row.value}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 justify-center mb-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-200 ${
                  i === stepIndex
                    ? 'w-4 h-2 bg-blue-600'
                    : i < stepIndex
                    ? 'w-2 h-2 bg-blue-300'
                    : 'w-2 h-2 bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              disabled={stepIndex === 0}
              className="flex-1 text-slate-500"
            >
              {isRTL ? 'הקודם' : 'Back'}
            </Button>

            {isPractice && nextDisabled ? (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="flex-1 text-slate-400 cursor-not-allowed opacity-60"
              >
                {isRTL ? 'הבא' : 'Next'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onNext}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {stepIndex === totalSteps - 1
                  ? (isRTL ? 'סיום' : 'Finish')
                  : (isRTL ? 'הבא' : 'Next')}
              </Button>
            )}
          </div>
        </>
      )}

    </div>
    </>
  );
}