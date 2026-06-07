import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle, PlayCircle, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { tTutorial } from './tutorialSteps';

const STORAGE_KEY = 'consenz_tutorial';
const LAST_DOC_KEY = 'consenz_last_doc_url';

function isDocumentPage(pathname) {
  return /\/(DocumentView|document)/i.test(pathname) || pathname.includes('urlName');
}

export default function TutorialRestartButton() {
  const { language, isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const label = tTutorial('nav.restart', language);

  // Track last visited document URL
  useEffect(() => {
    if (isDocumentPage(location.pathname)) {
      sessionStorage.setItem(LAST_DOC_KEY, location.pathname + location.search);
    }
  }, [location]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleRestart = () => {
    setOpen(false);

    // Reset localStorage state
    const fresh = {
      active: true,
      homeStepSeen: true,
      currentStep: 0,
      completedSteps: [],
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {}

    const onDoc = isDocumentPage(location.pathname);

    if (onDoc) {
      // Already on a document page — let TutorialController pick it up
      if (window.restartTutorial) {
        window.restartTutorial('document');
      } else {
        window.location.reload();
      }
      return;
    }

    // Navigate to last visited document if available
    const lastDoc = sessionStorage.getItem(LAST_DOC_KEY);
    if (lastDoc) {
      navigate(lastDoc);
      // TutorialController will resume on mount via loadState
      return;
    }

    // No document visited — show home intro
    if (window.restartTutorial) {
      window.restartTutorial('home');
    } else {
      navigate('/');
    }
  };

  return (
    <div
      ref={popoverRef}
      className="relative"
      style={{ position: 'relative' }}
    >
      {/* Trigger button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={label}
      >
        <HelpCircle className="w-4 h-4 flex-shrink-0" />
        <span>{label}</span>
      </button>

      {/* Popover */}
      {open && (
        <div
          className={`absolute z-50 bottom-full mb-2 ${isRTL ? 'right-0' : 'left-0'} w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-3`}
          dir={isRTL ? 'rtl' : 'ltr'}
          role="dialog"
          aria-label={label}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {language === 'he' ? 'עזרה' : language === 'ar' ? 'مساعدة' : 'Help'}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={handleRestart}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium transition-colors text-start"
          >
            <PlayCircle className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        </div>
      )}
    </div>
  );
}