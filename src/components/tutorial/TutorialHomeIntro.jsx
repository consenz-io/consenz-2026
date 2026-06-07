import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { tTutorial } from './tutorialSteps';
import { useLanguage } from '@/components/LanguageContext';

const TOOLTIP_WIDTH = 320;
const ARROW_SIZE = 10;

/**
 * Home-intro step renderer.
 * - No scrim / dark overlay
 * - Spotlight via box-shadow on the target element
 * - Tooltip anchored below the target
 * - No progress dots, no Back button
 */
export default function TutorialHomeIntro({ step, onSkip, isRTL }) {
  const { language } = useLanguage();
  const heading = tTutorial(step.heading, language) || step.heading;
  const body = tTutorial(step.body, language) || step.body;
  const successMsg = tTutorial(step.successMessage, language) || step.successMessage;
  const [tooltipStyle, setTooltipStyle] = useState(null);
  const [practiceCompleted, setPracticeCompleted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Position tooltip below target
  useEffect(() => {
    function update() {
      const el = document.querySelector(step.targetSelector);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      setTooltipStyle({
        left: Math.max(8, Math.min(window.innerWidth - TOOLTIP_WIDTH - 8, centerX - TOOLTIP_WIDTH / 2)),
        top: rect.bottom + ARROW_SIZE + 12,
      });
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [step.targetSelector]);

  // Spotlight on target (no scrim — only box-shadow ring)
  useEffect(() => {
    const el = document.querySelector(step.targetSelector);
    if (!el) return;
    const radius = window.getComputedStyle(el).borderRadius || '8px';
    el.style.position = 'relative';
    el.style.zIndex = '10001';
    el.style.borderRadius = radius;
    el.style.boxShadow = '0 0 0 6px rgba(59,130,246,0.4), 0 0 0 12px rgba(59,130,246,0.15)';
    el.style.transition = 'box-shadow 0.3s ease';
    return () => {
      el.style.position = '';
      el.style.zIndex = '';
      el.style.boxShadow = '';
      el.style.transition = '';
    };
  }, [step.targetSelector]);

  // Listen for completion event
  useEffect(() => {
    if (!step.completionEvent) return;
    const handler = () => {
      setPracticeCompleted(true);
      if (step.successMessage) {
        setShowSuccess(true);
      }
    };
    window.addEventListener(step.completionEvent, handler);
    return () => window.removeEventListener(step.completionEvent, handler);
  }, [step.completionEvent, step.successMessage]);

  if (!tooltipStyle) return null;

  return (
    <div
      className="fixed z-[10002] bg-white rounded-xl shadow-2xl border border-slate-200 p-4"
      style={{ width: TOOLTIP_WIDTH, position: 'fixed', ...tooltipStyle }}
      dir={isRTL ? 'rtl' : 'ltr'}
      role="dialog"
      aria-label={step.heading}
    >
      {/* Arrow pointing up */}
      <div
        className="absolute w-0 h-0"
        style={{
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderBottom: '10px solid white',
          top: -10,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      {showSuccess ? (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <CheckCircle className="w-10 h-10 text-green-500" />
          <p className="font-semibold text-green-700">{successMsg}</p>
        </div>
      ) : (
        <>
          <h3 className="font-bold text-slate-900 text-base mb-1">{heading}</h3>
          {body && <p className="text-sm text-slate-600 leading-relaxed mb-3">{body}</p>}
        </>
      )}

      {/* Skip link */}
      <div className="text-center mt-1">
        <button
          onClick={onSkip}
          className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
        >
          {isRTL ? 'דלג על הסיור' : 'Skip tour'}
        </button>
      </div>
    </div>
  );
}