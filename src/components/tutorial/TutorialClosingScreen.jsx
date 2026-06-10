import React from 'react';
import { Button } from '@/components/ui/button';
import { tTutorial } from './tutorialSteps';
import { useLanguage } from '@/components/LanguageContext';
import { PartyPopper } from 'lucide-react';

const STORAGE_KEY = 'consenz_tutorial';

export default function TutorialClosingScreen({ step, onDone, isRTL }) {
  const { language } = useLanguage();
  const heading = tTutorial(step.heading, language);
  const body = tTutorial(step.body, language);
  const cta = tTutorial(step.cta, language);

  const handleDone = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, active: false }));
    } catch {}
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/50 p-4">
      <div
        className="rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center tutorial-highlight-bubble"
        style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)', borderLeft: '4px solid #3b82f6' }}
        dir={isRTL ? 'rtl' : 'ltr'}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg mx-auto mb-4">
          <PartyPopper className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3 leading-snug">{heading}</h2>
        <p className="text-slate-600 leading-relaxed mb-6">{body}</p>
        <Button
          onClick={handleDone}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-3"
        >
          {cta}
        </Button>
      </div>
    </div>
  );
}