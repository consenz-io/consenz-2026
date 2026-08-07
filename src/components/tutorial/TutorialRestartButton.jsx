import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { base44 } from '@/api/base44Client';
import { tTutorial } from './tutorialSteps';

const STORAGE_KEY = 'consenz_tutorial';
const LAST_DOC_KEY = 'consenz_last_doc_url';

function isDocumentPage(pathname) {
  return /\/(DocumentView|document)/i.test(pathname) || pathname.includes('urlName');
}

function isCleanViewPage(pathname) {
  return /\/DocumentCleanView/i.test(pathname);
}

function isGroupPage(pathname) {
  return /\/GroupView/i.test(pathname);
}

function isSuggestionPage(pathname) {
  return /\/suggestiondetail/i.test(pathname);
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

  const handleRestart = async () => {
    const pathname = location.pathname;
    const onCleanView = isCleanViewPage(pathname);
    const onDoc = isDocumentPage(pathname) && !onCleanView;
    const onGroup = isGroupPage(pathname);
    const onSuggestion = isSuggestionPage(pathname);

    // If on a suggestion page, resolve its parent document and navigate there
    // first — the tour should open on the document the suggestion belongs to.
    if (onSuggestion) {
      const suggestionId = new URLSearchParams(location.search).get('id');
      let documentId = null;
      if (suggestionId) {
        try {
          const suggestion = await base44.entities.Suggestion.get(suggestionId);
          documentId = suggestion?.documentId || null;
        } catch {
          // fall through — no document resolved
        }
      }
      const fresh = { active: true, homeStepSeen: true, currentStep: 0, completedSteps: [] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch {}
      if (documentId) {
        navigate(`/DocumentView?id=${documentId}`);
      }
      // Begin the tour on the (now) document page
      if (window.restartTutorial) {
        window.restartTutorial('document');
      }
      return;
    }

    // If on the versions page (DocumentCleanView), navigate back to the relevant
    // document page and start the tour from the very first bubble.
    if (onCleanView) {
      const documentId = new URLSearchParams(location.search).get('id');
      const fresh = { active: true, homeStepSeen: true, currentStep: 0, completedSteps: [] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch {}
      if (documentId) {
        navigate(`/DocumentView?id=${documentId}`);
      }
      if (window.restartTutorial) {
        window.restartTutorial('document', 0);
      }
      return;
    }

    const fresh = {
      active: true,
      homeStepSeen: onDoc, // skip home-intro if on a document page
      currentStep: 0,
      completedSteps: [],
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {}

    // Trigger tutorial restart
    const entryPoint = onDoc ? 'document' : onGroup ? 'group' : 'home';
    if (window.restartTutorial) {
      window.restartTutorial(entryPoint, 0);
    } else {
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