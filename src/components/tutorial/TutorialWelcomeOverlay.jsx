import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X, Compass } from 'lucide-react';
import { tTutorial } from './tutorialSteps';
import { useLanguage } from '@/components/LanguageContext';

/**
 * Centered welcome overlay shown as the very first step of the tutorial.
 * Explains to the user that they're about to receive a step-by-step tour.
 * After clicking "Let's start", the user is redirected to the home page
 * (if not already there) and the actual tour begins.
 */
export default function TutorialWelcomeOverlay({ onStart, onSkip, isRTL }) {
  const { language } = useLanguage();
  const heading = tTutorial('welcome.overlay.heading', language);
  const body = tTutorial('welcome.overlay.body', language);
  const cta = tTutorial('welcome.overlay.cta', language);

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div
        className="relative rounded-2xl shadow-2xl border-l-4 border-blue-500 p-6 tutorial-highlight-bubble max-w-sm w-full"
        style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)' }}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <button
          onClick={onSkip}
          className="absolute top-3 end-3 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded"
          aria-label={isRTL ? 'סגור' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tour badge */}
        <div className="flex items-center gap-1 text-blue-600 mb-3">
          <Compass className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wide">{isRTL ? 'סיור מודרך' : 'Guided Tour'}</span>
        </div>

        <h3 className="font-bold text-slate-900 text-xl mb-3 break-words">{heading}</h3>
        <p className="text-sm text-slate-600 leading-relaxed mb-5">{body}</p>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="flex-1 text-slate-500"
          >
            {isRTL ? 'דלגו' : 'Skip'}
          </Button>
          <Button
            size="sm"
            onClick={onStart}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {cta}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}