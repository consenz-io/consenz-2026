import React from 'react';
import { Button } from '@/components/ui/button';

export default function TutorialWelcome({ onStart, onSkip, isRTL }) {
  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/40" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 flex flex-col gap-4">
        {/* Icon */}
        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
        </div>

        {/* Headline — placeholder, content added later */}
        <h2 className="text-xl font-bold text-slate-900 text-center">
          ברוכים ל-Consenz
        </h2>

        {/* Body — placeholder */}
        <p className="text-slate-600 text-sm text-center leading-relaxed">
          רוצים ללמוד איך הפלטפורמה עובדת? קחו סיור קצר של כמה שניות.
        </p>

        {/* Actions */}
        <div className={`flex flex-col gap-2 mt-2 ${isRTL ? '' : ''}`}>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onStart}
          >
            קבלו סיור קצר
          </Button>
          <Button
            variant="ghost"
            className="w-full text-slate-500"
            onClick={onSkip}
          >
            מכירים את המערכת? דלגו
          </Button>
        </div>
      </div>
    </div>
  );
}