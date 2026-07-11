import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, X, Compass } from 'lucide-react';
import { tTutorial } from './tutorialSteps';
import { useLanguage } from '@/components/LanguageContext';

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth <= 768);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

const TOOLTIP_WIDTH = 320;
const ARROW_SIZE = 10;

/**
 * Home-intro step renderer.
 * - No scrim / dark overlay
 * - Spotlight via box-shadow on the target element
 * - Tooltip anchored below the target
 * - No progress dots, no Back button
 */
export default function TutorialHomeIntro({ step, nextStep, onSkip, onRequestSkip, isRTL, ctaText }) {
  const { language } = useLanguage();
  const isMobile = useIsMobile();
  const [activeStep, setActiveStep] = useState(step);
  const heading = tTutorial(activeStep.heading, language) || activeStep.heading;
  const body = tTutorial(activeStep.body, language) || activeStep.body;
  const successMsg = tTutorial(activeStep.successMessage, language) || activeStep.successMessage;
  const [tooltipStyle, setTooltipStyle] = useState(null);
  const [practiceCompleted, setPracticeCompleted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const tooltipRef = useRef(null);

  // Reset state when step changes
  useEffect(() => {
    setActiveStep(step);
    setPracticeCompleted(false);
    setShowSuccess(false);
    setTooltipStyle(null);
  }, [step]);

  const [arrowDirection, setArrowDirection] = useState('down'); // 'up' | 'down' | 'left' | 'right' | 'none'

  // Position tooltip + spotlight — poll until element is in DOM (handles async data load)
  useEffect(() => {
    let cleanupSpotlight = null;

    function applySpotlight(el) {
      const radius = window.getComputedStyle(el).borderRadius || '8px';
      el.style.position = 'relative';
      el.style.zIndex = '10001';
      el.style.borderRadius = radius;
      if (isMobile) {
        // On mobile: use outline ring instead of full scrim so content stays visible
        el.style.outline = '3px solid #3b82f6';
        el.style.outlineOffset = '4px';
        el.style.boxShadow = '0 0 0 6px rgba(59,130,246,0.25)';
      } else {
        el.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.5)';
      }
      el.style.transition = 'box-shadow 0.3s ease';
      return () => {
        el.style.position = '';
        el.style.zIndex = '';
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.boxShadow = '';
        el.style.transition = '';
      };
    }

    function scrollTargetAboveSheet(el) {
      const sheet = document.querySelector('.tutorial-highlight-bubble');
      const sheetHeight = sheet ? sheet.getBoundingClientRect().height : 220;
      const margin = 12;
      const visibleHeight = window.innerHeight - sheetHeight;
      const rect = el.getBoundingClientRect();
      if (rect.bottom > visibleHeight - margin || rect.top < 0) {
        let targetY;
        if (rect.height > visibleHeight - margin) {
          targetY = window.scrollY + rect.top - 8;
        } else {
          targetY = window.scrollY + rect.bottom - visibleHeight + margin;
        }
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      }
    }

    function updatePosition(el) {
      const rect = el.getBoundingClientRect();
      const position = activeStep.tooltipPosition;

      if (position === 'sidebar' || position === 'fixed-top-left') {
        const sidebar = document.querySelector('[data-sidebar="sidebar"]') || document.querySelector('aside');
        const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 0;
        setArrowDirection('none');
        setTooltipStyle({ left: Math.max(16, sidebarWidth + 16), top: 80, transform: 'none' });
        return;
      }
      if (position === 'right') {
        const top = Math.max(8, Math.min(window.innerHeight - 220, rect.top + rect.height / 2 - 90));
        setArrowDirection('left');
        setTooltipStyle({ left: rect.right + ARROW_SIZE + 12, top, transform: 'none' });
        return;
      }
      if (position === 'left') {
        const top = Math.max(8, Math.min(window.innerHeight - 220, rect.top + rect.height / 2 - 90));
        setArrowDirection('right');
        setTooltipStyle({ left: rect.left - TOOLTIP_WIDTH - ARROW_SIZE - 12, top, transform: 'none' });
        return;
      }
      const centerX = rect.left + rect.width / 2;
      const left = Math.max(8, Math.min(window.innerWidth - TOOLTIP_WIDTH - 8, centerX - TOOLTIP_WIDTH / 2));
      const spaceAbove = rect.top;
      if (spaceAbove >= 180 + ARROW_SIZE + 12) {
        setArrowDirection('down');
        setTooltipStyle({ left, top: rect.top - ARROW_SIZE - 12, transform: 'translateY(-100%)' });
      } else {
        setArrowDirection('up');
        setTooltipStyle({ left, top: rect.bottom + ARROW_SIZE + 12, transform: 'none' });
      }
    }

    function tryInit() {
      const el = document.querySelector(activeStep.targetSelector);
      if (!el) return false;
      updatePosition(el);
      cleanupSpotlight = applySpotlight(el);
      if (isMobile) {
        scrollTargetAboveSheet(el);
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return true;
    }

    // Try immediately, then poll every 200ms up to 3s if element not yet in DOM
    if (!tryInit()) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (tryInit() || attempts >= 15) clearInterval(interval);
      }, 200);
    }

    function handleScroll() {
      const el = document.querySelector(activeStep.targetSelector);
      if (el) updatePosition(el);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (cleanupSpotlight) cleanupSpotlight();
    };
  }, [activeStep.targetSelector, activeStep.tooltipPosition]);

  // Listen for completion event
  useEffect(() => {
    if (!activeStep.completionEvent) return;
    const handler = () => {
      setPracticeCompleted(true);
      if (activeStep.successMessage) {
        setShowSuccess(true);
      }
    };
    window.addEventListener(activeStep.completionEvent, handler);
    return () => window.removeEventListener(activeStep.completionEvent, handler);
  }, [activeStep.completionEvent, activeStep.successMessage]);

  const handleNext = () => {
    if (nextStep && activeStep.type === 'explain') {
      setActiveStep(nextStep);
    }
  };

  // Mobile: bottom sheet, no positioning needed
  if (isMobile) {
    return createPortal(
      <div
        className="fixed bottom-0 inset-x-0 z-[99999] rounded-t-2xl shadow-2xl border-t-4 border-blue-500 p-5 tutorial-highlight-bubble"
        style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)' }}
        dir={isRTL ? 'rtl' : 'ltr'}
        role="dialog"
        aria-label={step.heading}
      >
        <button
          onClick={() => onRequestSkip ? onRequestSkip() : onSkip()}
          className="absolute top-3 end-3 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded"
          aria-label={isRTL ? 'סגור' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>
        {/* Tour badge */}
        <div className="flex items-center gap-1 text-blue-600 mb-2">
          <Compass className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase tracking-wide">{isRTL ? 'סיור' : 'Tour'}</span>
        </div>

        {showSuccess ? (
           <div className="flex flex-col items-center gap-2 py-3 text-center">
             <CheckCircle className="w-10 h-10 text-green-500" />
             <p className="font-semibold text-green-700">{successMsg}</p>
           </div>
         ) : (
           <>
             <h3 className="font-bold text-slate-900 text-lg mb-2 pe-6">{heading}</h3>
            {body && <p className="text-sm text-slate-600 leading-relaxed mb-3">{body}</p>}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-sm font-bold text-blue-800">
                {ctaText || (isRTL ? 'בחרו קבוצה ונמשיך' : 'Click on a group to continue')}
              </p>
            </div>
          </>
        )}
      </div>,
      document.body
    );
  }

  if (!tooltipStyle) return null;

  return createPortal(
    <>
      <div
        ref={tooltipRef}
        className="fixed z-[10002] rounded-xl shadow-2xl border-l-4 border-blue-500 p-4 tutorial-highlight-bubble"
        style={{ width: TOOLTIP_WIDTH, position: 'fixed', background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)', ...tooltipStyle }}
        dir={isRTL ? 'rtl' : 'ltr'}
        role="dialog"
        aria-label={step.heading}
      >
        <button
          onClick={() => onRequestSkip ? onRequestSkip() : onSkip()}
          className="absolute top-2 end-2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded"
          aria-label={isRTL ? 'סגור' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tour badge */}
        <div className="flex items-center gap-1 text-blue-600 mb-2">
          <Compass className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase tracking-wide">{isRTL ? 'סיור' : 'Tour'}</span>
        </div>

        {arrowDirection !== 'none' && <div
          className="absolute w-0 h-0"
          style={
            arrowDirection === 'down' ? {
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '10px solid #eff6ff',
              bottom: -10,
              left: '50%',
              transform: 'translateX(-50%)',
            } : arrowDirection === 'up' ? {
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderBottom: '10px solid #eff6ff',
              top: -10,
              left: '50%',
              transform: 'translateX(-50%)',
            } : arrowDirection === 'left' ? {
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderRight: '10px solid #eff6ff',
              left: -10,
              top: '50%',
              transform: 'translateY(-50%)',
            } : {
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderLeft: '10px solid #eff6ff',
              right: -10,
              top: '50%',
              transform: 'translateY(-50%)',
            }
          }
        />}

        {showSuccess ? (
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="font-semibold text-green-700">{successMsg}</p>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-slate-900 text-lg mb-2 pr-5">{heading}</h3>
            {body && <p className="text-sm text-slate-600 leading-relaxed mb-3">{body}</p>}
            <div className="text-center mb-2">
              <p className="text-xs text-slate-500 italic">
                {ctaText || (isRTL ? 'בחרו קבוצה ונמשיך' : 'Click on a group to continue')}
              </p>
            </div>
            {activeStep.type === 'explain' && nextStep && (
              <button
                onClick={handleNext}
                className="w-full mt-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isRTL ? 'הבא' : 'Next'}
              </button>
            )}
          </>
        )}
      </div>
    </>,
    document.body
  );
}