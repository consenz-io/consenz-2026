import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, UserPlus, PartyPopper, ChevronDown, ChevronUp } from 'lucide-react';
import { tTutorial } from './tutorialSteps';
import { useLanguage } from '@/components/LanguageContext';
import { base44 } from '@/api/base44Client';

/**
 * Mobile-optimised tutorial sheet.
 * Renders as a bottom drawer instead of a floating tooltip,
 * keeping the spotlighted element visible above it.
 */
export default function TutorialMobileSheet({
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
  isSummary,
  onOpenPointsModal,
  onRequestSkip
}) {
  const { language } = useLanguage();
  const heading = tTutorial(step.heading, language);
  const body = tTutorial(step.body, language);
  const learnMoreText = step.id === 'points-ranking-explain' ? tTutorial('points.ranking.explain.learnMore', language) : null;
  const successMessage = tTutorial(step.successMessage, language);
  const ctaLabel = step.ctaLabel ? tTutorial(step.ctaLabel, language) : null;

  const [expanded, setExpanded] = useState(true);

  const isPractice = step.type === 'practice';
  const nextDisabled = isPractice && !practiceCompleted;

  const handleSkipRequest = () => {
    if (typeof onRequestSkip === 'function') {
      onRequestSkip();
    }
  };

  // Progress dots
  const ProgressDots = () =>
  <div className="flex items-center gap-1 justify-center">
      {Array.from({ length: totalSteps }).map((_, i) =>
    <div
      key={i}
      className={`rounded-full transition-all duration-200 ${
      i === stepIndex ? 'w-4 h-2 bg-blue-600' : i < stepIndex ? 'w-2 h-2 bg-blue-300' : 'w-2 h-2 bg-slate-200'}`
      } />

    )}
    </div>;


  // Signup prompt
  if (showSignupPrompt) {
    return (
      <div
        className="fixed bottom-0 inset-x-0 z-[10002] rounded-t-2xl shadow-2xl border-t-2 border-blue-300 p-5 pb-safe"
        style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)' }}
        dir={isRTL ? 'rtl' : 'ltr'}>
        
        <div className="flex flex-col items-center gap-3 text-center">
          <UserPlus className="w-9 h-9 text-blue-500" />
          <h3 className="font-bold text-slate-900 text-base">{tTutorial('signup.prompt.heading', language)}</h3>
          <p className="text-sm text-slate-600">{tTutorial('signup.prompt.body', language)}</p>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => base44.auth.redirectToLogin(window.location.href)}>
            {tTutorial('signup.prompt.cta', language)}
          </Button>
        </div>
      </div>);

  }

  // Success state
  if (showSuccess && successMessage) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[10002] rounded-t-2xl shadow-2xl border-t-2 border-blue-300 p-5 pb-safe" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)' }} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex flex-col items-center gap-2 text-center">
          <CheckCircle className="w-10 h-10 text-green-500" />
          <p className="font-semibold text-green-700">{successMessage}</p>
        </div>
      </div>);

  }

  // Summary step
  if (isSummary) {
    return (
      <div
        className="fixed bottom-0 inset-x-0 z-[10002] rounded-t-2xl shadow-2xl border-t-2 border-blue-300 p-5 pb-safe"
        style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)' }}
        dir={isRTL ? 'rtl' : 'ltr'}>
        
        <button onClick={handleSkipRequest} className="absolute top-3 end-3 text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
            <PartyPopper className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-slate-900 text-base leading-snug">{heading}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
          <ProgressDots />
          <div className="flex gap-2 w-full">
            <Button variant="ghost" size="sm" onClick={onBack} className="flex-1 text-slate-500">
              {isRTL ? 'הקודם' : 'Back'}
            </Button>
            <Button size="sm" onClick={onNext} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              {isRTL ? 'סיום' : 'Finish'}
            </Button>
          </div>
        </div>
      </div>);

  }

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[10002] rounded-t-2xl shadow-2xl border-t-2 border-blue-300"
      style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)' }}
      dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Drag handle + close */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[hsl(var(--sidebar-background))]">
        {/* Tap to expand/collapse body */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-slate-700 font-bold text-sm flex-1 min-w-0"
          aria-expanded={expanded}>
          
          <span className="truncate">{heading}</span>
          {expanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronUp className="w-4 h-4 flex-shrink-0" />}
        </button>
        <button onClick={handleSkipRequest} className="ms-2 text-slate-400 hover:text-slate-600 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Expandable body */}
      {expanded && body &&
      <div className="px-4 pb-2">
          <p className="text-sm text-slate-600 leading-relaxed">
            {body}
            {learnMoreText && onOpenPointsModal &&
          <>
                {' '}
                <button 
                  onClick={() => setTimeout(onOpenPointsModal, 100)}
                  className="text-blue-600 hover:text-blue-700 underline font-medium"
                >
                    {learnMoreText}
                  </button>
              </>
          }
          </p>
          {/* Points table */}
          {step.table && step.table.length > 0 &&
        <table className="w-full text-xs mt-2 border-collapse">
              <tbody>
                {step.table.map((row, i) => {
              const isCost = row.value.startsWith('−') || row.value.startsWith('-');
              return (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-1 text-slate-600 text-start">{tTutorial(row.label, language)}</td>
                      <td className={`py-1 font-bold text-end ${isCost ? 'text-red-600' : 'text-green-600'}`}>{row.value}</td>
                    </tr>);

            })}
              </tbody>
            </table>
        }
        </div>
      }

      {/* Footer: progress dots + navigation */}
      <div className="px-4 pb-4 pt-1 space-y-2">
        <ProgressDots />
        {ctaLabel && nextDisabled ?
        <div className="w-full py-2 px-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium text-center">
            {ctaLabel}
          </div> :

        <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} disabled={stepIndex === 0} className="flex-1 text-slate-500">
              {isRTL ? 'הקודם' : 'Back'}
            </Button>
            {isPractice && nextDisabled ?
          <Button variant="outline" size="sm" disabled className="flex-1 text-slate-400 opacity-60">
                {isRTL ? 'הבא' : 'Next'}
              </Button> :

          <Button size="sm" onClick={onNext} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]">
                {stepIndex === totalSteps - 1 ? isRTL ? 'סיום' : 'Finish' : isRTL ? 'הבא' : 'Next'}
              </Button>
          }
          </div>
        }
      </div>
    </div>);

}