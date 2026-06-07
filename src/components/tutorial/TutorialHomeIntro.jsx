import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { tTutorial } from './tutorialSteps';
import { useLanguage } from '@/components/LanguageContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const TOOLTIP_WIDTH = 320;
const ARROW_SIZE = 10;

/**
 * Home-intro step renderer.
 * - No scrim / dark overlay
 * - Spotlight via box-shadow on the target element
 * - Tooltip anchored below the target
 * - No progress dots, no Back button
 */
export default function TutorialHomeIntro({ step, nextStep, onSkip, isRTL }) {
  const { language } = useLanguage();
  const [activeStep, setActiveStep] = useState(step);
  const heading = tTutorial(activeStep.heading, language) || activeStep.heading;
  const body = tTutorial(activeStep.body, language) || activeStep.body;
  const successMsg = tTutorial(activeStep.successMessage, language) || activeStep.successMessage;
  const [tooltipStyle, setTooltipStyle] = useState(null);
  const [practiceCompleted, setPracticeCompleted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const tooltipRef = useRef(null);

  // Reset state when step changes
  useEffect(() => {
    setActiveStep(step);
    setPracticeCompleted(false);
    setShowSuccess(false);
    setTooltipStyle(null);
  }, [step]);

  // Position tooltip below target
  useEffect(() => {
    function update() {
      const el = document.querySelector(activeStep.targetSelector);
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
  }, [activeStep.targetSelector]);

  // Scroll target element into view on mount
  useEffect(() => {
    const el = document.querySelector(activeStep.targetSelector);
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, [activeStep.targetSelector]);

  // Spotlight on target (no scrim — only box-shadow ring)
  useEffect(() => {
    const el = document.querySelector(activeStep.targetSelector);
    if (!el) return;
    const radius = window.getComputedStyle(el).borderRadius || '8px';
    
    // Get the element's bounding rect to determine if we need to expand the spotlight
    const rect = el.getBoundingClientRect();
    let expandedHeight = rect.height;
    
    // If target contains a carousel, expand spotlight to include carousel content below
    const carousel = el.querySelector('[role="region"]') || el.nextElementSibling;
    if (carousel) {
      const carouselRect = carousel.getBoundingClientRect();
      expandedHeight = carouselRect.bottom - rect.top + 20; // +20px for padding
    }
    
    el.style.position = 'relative';
    el.style.zIndex = '10001';
    el.style.borderRadius = radius;
    el.style.boxShadow = `0 0 0 6px rgba(59,130,246,0.4), 0 0 0 12px rgba(59,130,246,0.15), inset 0 0 0 ${expandedHeight}px rgba(59,130,246,0.05)`;
    el.style.transition = 'box-shadow 0.3s ease';
    return () => {
      el.style.position = '';
      el.style.zIndex = '';
      el.style.boxShadow = '';
      el.style.transition = '';
    };
  }, [activeStep.targetSelector]);

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

  if (!tooltipStyle) return null;

  return (
    <>
      <div
        ref={tooltipRef}
        className="fixed z-[10002] bg-white rounded-xl shadow-2xl border border-slate-200 p-4"
        style={{ width: TOOLTIP_WIDTH, position: 'fixed', ...tooltipStyle }}
        dir={isRTL ? 'rtl' : 'ltr'}
        role="dialog"
        aria-label={step.heading}
      >
        {/* X button */}
        <button
          onClick={() => setShowSkipConfirm(true)}
          className="absolute top-2 end-2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded"
          aria-label={isRTL ? 'סגור' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>

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
            <h3 className="font-bold text-slate-900 text-base mb-1 pr-5">{heading}</h3>
            {body && <p className="text-sm text-slate-600 leading-relaxed mb-3">{body}</p>}
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

      <AlertDialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'לצאת מהסיור?' : 'Exit the tour?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? 'תמיד אפשר להפעיל אותו מחדש מהתפריט.' : 'You can always restart it from the menu.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'המשך' : 'Continue'}</AlertDialogCancel>
            <AlertDialogAction onClick={onSkip}>{isRTL ? 'צא מהסיור' : 'Exit tour'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}