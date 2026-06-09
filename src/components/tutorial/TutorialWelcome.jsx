import React from 'react';
import { Button } from '@/components/ui/button';

const strings = {
  he: {
    headline: 'ברוכים ל-Consenz',
    body: 'רוצים ללמוד איך הפלטפורמה עובדת? קחו סיור קצר של כמה שניות.',
    start: 'קבלו סיור קצר',
    skip: 'מכירים את המערכת? דלגו',
  },
  ar: {
    headline: 'مرحباً بكم في Consenz',
    body: 'هل تريدون تعلّم كيفية عمل المنصة؟ خذوا جولة قصيرة تستغرق ثوانٍ.',
    start: 'خذ جولة قصيرة',
    skip: 'تعرف على النظام؟ تخطَّ',
  },
  en: {
    headline: 'Welcome to Consenz',
    body: 'Want to learn how the platform works? Take a quick tour in just a few seconds.',
    start: 'Take a quick tour',
    skip: 'Already familiar? Skip',
  },
};

export default function TutorialWelcome({ onStart, onSkip, isRTL, language = 'he' }) {
  const lang = strings[language] || strings.he;
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

        <h2 className="text-xl font-bold text-slate-900 text-center">
          {lang.headline}
        </h2>

        <p className="text-slate-600 text-sm text-center leading-relaxed">
          {lang.body}
        </p>

        <div className="flex flex-col gap-2 mt-2">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onStart}
          >
            {lang.start}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-slate-500"
            onClick={onSkip}
          >
            {lang.skip}
          </Button>
        </div>
      </div>
    </div>
  );
}