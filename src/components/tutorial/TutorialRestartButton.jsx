import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { tTutorial } from './tutorialSteps';

const STORAGE_KEY = 'consenz_tutorial';
const LAST_DOC_KEY = 'consenz_last_doc_url';

function isDocumentPage(pathname) {
  return /\/(DocumentView|document)/i.test(pathname) || pathname.includes('urlName');
}

export default function TutorialRestartButton() {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const label = tTutorial('nav.restart', language);

  // Track last visited document URL
  useEffect(() => {
    if (isDocumentPage(location.pathname)) {
      sessionStorage.setItem(LAST_DOC_KEY, location.pathname + location.search);
    }
  }, [location]);

  const handleRestart = () => {
    const onDoc = isDocumentPage(location.pathname);

    const fresh = {
      active: true,
      homeStepSeen: onDoc, // skip home-intro if already on a document
      currentStep: 0,
      completedSteps: [],
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {}

    // Trigger tutorial restart
    if (window.restartTutorial) {
      window.restartTutorial(onDoc ? 'document' : 'home');
    } else {
      // Fallback if window.restartTutorial not yet ready
      if (onDoc) {
        window.location.reload();
      } else {
        navigate('/');
      }
    }
  };

  return (
    <button
      onClick={handleRestart}
      data-tutorial-restart-btn
      className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 min-h-[44px]"
    >
      <PlayCircle className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </button>
  );
}