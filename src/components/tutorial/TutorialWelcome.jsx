import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, HelpCircle } from 'lucide-react';

const strings = {
  he: {
    headline: 'סיור בפלטפורמה',
    body: 'רוצים ללמוד איך הפלטפורמה עובדת?',
    start: 'בואו נתחיל',
    close: 'סגור',
  },
  ar: {
    headline: 'جولة في المنصة',
    body: 'هل تريدون تعلّم كيفية عمل المنصة؟',
    start: 'لنبدأ',
    close: 'إغلاق',
  },
  en: {
    headline: 'Platform Tour',
    body: 'Want to learn how the platform works?',
    start: 'Let\'s start',
    close: 'Close',
  },
};

export default function TutorialWelcome({ onStart, onSkip, isRTL, language = 'he' }) {
  const lang = strings[language] || strings.he;
  const [isVisible, setIsVisible] = useState(false);

  // Appear after 20 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 20000);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed z-[10002] top-6 ${isRTL ? 'left-6' : 'right-6'} max-w-xs w-96`} 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Arrow pointer */}
      <div className={`absolute ${isRTL ? '-left-2' : '-right-2'} top-8 w-4 h-4 bg-white transform rotate-45 shadow-lg`} />
      
      {/* Bubble */}
      <div className="bg-white rounded-xl shadow-2xl border border-blue-200 p-4 relative">
        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-2 end-2 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label={isRTL ? 'סגור' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">
            {lang.headline}
          </h3>
        </div>

        <p className="text-slate-600 text-xs leading-relaxed mb-3">
          {lang.body}
        </p>

        <div className="flex gap-2">
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
            onClick={onStart}
          >
            {lang.start}
          </Button>
        </div>
      </div>
    </div>
  );
}