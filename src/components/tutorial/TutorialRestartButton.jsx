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

function useRestartLogic() {
  const location = useLocation();
  const navigate = useNavigate();

  // Track last visited document URL
  useEffect(() => {
    if (isDocumentPage(location.pathname)) {
      sessionStorage.setItem(LAST_DOC_KEY, location.pathname + location.search);
    }
  }, [location]);

  const handleRestart = () => {
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
      if (window.restartTutorial) {
        window.restartTutorial('document');
      } else {
        window.location.reload();
      }
      return;
    }

    const lastDoc = sessionStorage.getItem(LAST_DOC_KEY);
    if (lastDoc) {
      navigate(lastDoc);
      return;
    }

    if (window.restartTutorial) {
      window.restartTutorial('home');
    } else {
      navigate('/');
    }
  };

  return handleRestart;
}

/** Inline sidebar button */
function SidebarButton({ label, isRTL }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const handleRestart = useRestartLogic();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={popoverRef} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
        aria-expanded={open}
      >
        <HelpCircle className="w-4 h-4 flex-shrink-0" />
        <span>{label}</span>
      </button>

      {open && (
        <div
          className={`absolute z-50 bottom-full mb-2 ${isRTL ? 'right-0' : 'left-0'} w-52 bg-white border border-slate-200 rounded-xl shadow-xl p-2`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <button
            onClick={() => { setOpen(false); handleRestart(); }}
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

/** Floating `?` button anchored bottom-inline-end */
function FloatingButton({ label, isRTL }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const handleRestart = useRestartLogic();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-40"
      style={{ insetBlockEnd: '1.5rem', insetInlineEnd: '1.5rem' }}
    >
      {/* Popover */}
      {open && (
        <div
          className={`absolute bottom-full mb-3 ${isRTL ? 'right-0' : 'right-0'} w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-3`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {isRTL ? 'עזרה' : 'Help'}
            </span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => { setOpen(false); handleRestart(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium transition-colors text-start"
          >
            <PlayCircle className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        </div>
      )}

      {/* The `?` button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center text-lg font-bold transition-all hover:scale-110 focus:ring-4 focus:ring-blue-300"
        aria-label={label}
        title={label}
      >
        ?
      </button>
    </div>
  );
}

export default function TutorialRestartButton({ floating = false }) {
  const { language, isRTL } = useLanguage();
  const label = tTutorial('nav.restart', language);

  if (floating) {
    return <FloatingButton label={label} isRTL={isRTL} />;
  }

  return <SidebarButton label={label} isRTL={isRTL} />;
}