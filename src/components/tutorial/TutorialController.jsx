import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTutorial } from './useTutorial';
import { TUTORIAL_STEPS, HOME_INTRO_STEP, GROUP_INTRO_STEP, GROUP_EXPLAIN_STEP, WELCOME_INTRO_PREPARE_STEP } from './tutorialSteps';
import TutorialWelcomeBubble from './TutorialWelcomeBubble';
import TutorialWelcomeOverlay from './TutorialWelcomeOverlay';
import TutorialWelcome from './TutorialWelcome';
import TutorialOverlay from './TutorialOverlay';
import TutorialTooltip from './TutorialTooltip';
import TutorialHomeIntro from './TutorialHomeIntro';
import TutorialGhostVoting from './TutorialGhostVoting';
import TutorialGhostPoints from './TutorialGhostPoints';
import TutorialMobileSheet from './TutorialMobileSheet';
import TutorialReturnButton from './TutorialReturnButton';
import PointsInfoModal from '@/components/points/PointsInfoModal';
import { useLanguage } from '@/components/LanguageContext';

// Detect mobile viewport (≤768px)
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth <= 768);
  React.useEffect(() => {
    let timeoutId;
    const handler = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsMobile(window.innerWidth <= 768), 150);
    };
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      clearTimeout(timeoutId);
    };
  }, []);
  return isMobile;
}

// How long to suppress tooltip rendering after a navigation action (ms).
// Gives the new page time to mount and render its DOM before we try to find target elements.
const NAV_DELAY_MS = 600;

function isDocumentPage(pathname) {
  // Only the actual document page counts — NOT DocumentComments, DocumentAdmin, etc.
  return /^\/DocumentView(\/|$)/i.test(pathname) || pathname.includes('urlName');
}

function isHomePage(pathname) {
  return pathname === '/' || pathname === '/Home' || pathname === '';
}

function isGroupPage(pathname) {
  return /\/GroupView/i.test(pathname) || /\/group/i.test(pathname);
}

function isVersionsPage(pathname) {
  return /\/DocumentCleanView/i.test(pathname);
}

function getStepPage(step) {
  if (!step) return null;
  if (step.page) return step.page;
  if (step.id === 'welcome-intro-prepare') return null;
  if (step.id === 'versions-browse-explain' || step.id === 'versions-change-explain') return 'versions';
  return 'document';
}

function getPageFromPathname(pathname) {
  if (isHomePage(pathname)) return 'home';
  if (isGroupPage(pathname)) return 'group';
  if (isVersionsPage(pathname)) return 'versions';
  if (isDocumentPage(pathname)) return 'document';
  return null;
}

export default function TutorialController() {
  const { isRTL, language } = useLanguage();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  // Suppress tooltip rendering briefly after a page navigation so the new DOM can settle.
  const [navPending, setNavPending] = useState(false);
  const navTimerRef = useRef(null);

  // Track the last-known documentId so the "Return to tour" button can navigate
  // back to the correct document when the user wanders off during the tour.
  const lastDocumentIdRef = useRef(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('id');
    if (docId && (isDocumentPage(location.pathname) || isVersionsPage(location.pathname))) {
      lastDocumentIdRef.current = docId;
    }
  }, [location.pathname]);

  // Open the persistent points-info modal when the ghost points badge is clicked.
  // The ghost badge lives inside the tutorial layer (unmounted when a dialog opens),
  // so it dispatches an event and this controller owns the actual modal.
  useEffect(() => {
    const openModal = () => setShowPointsModal(true);
    window.addEventListener('tutorial:openPointsModal', openModal);
    return () => window.removeEventListener('tutorial:openPointsModal', openModal);
  }, []);

  // Suppress tutorial overlay/tooltip when any app modal is open
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    let debounceId;
    function checkModal() {
      clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        const hasModal = !!(
          document.querySelector('[role="dialog"][data-state="open"]') ||
          document.querySelector('[data-radix-dialog-overlay]') ||
          document.querySelector('[data-radix-alert-dialog-overlay]')
        );
        setModalOpen(hasModal);
      }, 50);
    }
    checkModal();
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
    return () => {
      observer.disconnect();
      clearTimeout(debounceId);
    };
  }, []);

  const {
    phase,
    currentStep,
    totalSteps,
    homeStepSeen,
    practiceCompleted,
    showSuccess,
    showSignupPrompt,
    isAuthenticated,
    beginFromWelcome,
    beginFromWelcomeOverlay,
    backToWelcomeOverlay,
    resumeOnDocumentPage,
    skipTutorial,
    pauseTutorial,
    resumeTutorial,
    goNext,
    goBack,
    restartTutorial,
  } = useTutorial(TUTORIAL_STEPS);

  // ── Auto-start for new users ──────────────────────────────────────────────
  // New users (no local + no server tutorial state) auto-receive the welcome
  // overlay via useTutorial's hydrate(). Returning users start the tour only
  // via the "Tour the platform" button (TutorialRestartButton → restartTutorial).

  // ── Transition: home-intro → group page ─────────────────────────────────
  useEffect(() => {
    if (phase === 'home-intro' && homeStepSeen && isGroupPage(location.pathname)) {
      // Stay in home-intro phase but switch to group step — handled in render
    }
  }, [location.pathname, phase, homeStepSeen]);

  // ── Resume when navigating TO a document page ────────────────────────────
  // (Only as fallback — primary transition is done via document:entered event in useTutorial)
  useEffect(() => {
    if (phase === 'home-intro' && homeStepSeen && isDocumentPage(location.pathname)) {
      resumeOnDocumentPage();
    }
  }, [location.pathname, phase, homeStepSeen, resumeOnDocumentPage]);

  // ── Expose restart + resume globally ─────────────────────────────────────
  useEffect(() => {
    window.restartTutorial = (entryPoint, startStep = 0) =>
      restartTutorial(entryPoint || (isHomePage(location.pathname) ? 'home' : 'document'), startStep);
    window.resumeTutorial = () => resumeTutorial();
    return () => {
      delete window.restartTutorial;
      delete window.resumeTutorial;
    };
  }, [restartTutorial, resumeTutorial, location.pathname]);

  // ── Skip missing target elements ────────────────────────────────────────────
  const manualNavRef = useRef(false);
  // Set true right after the user clicks "Let's start" on the welcome overlay,
  // so we force-scroll to the first visible step once it mounts.
  const justStartedRef = useRef(false);

  // ── Force-scroll to the first step's target after starting from welcome overlay ──
  useEffect(() => {
    if (phase !== 'running' || !justStartedRef.current) return;
    const step = TUTORIAL_STEPS[currentStep];
    // Wait past the auto-skipped welcome-intro-prepare step (no targetSelector)
    if (!step || !step.targetSelector) return;

    justStartedRef.current = false;

    let attempts = 0;
    const tryScroll = () => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempts < 8) {
        attempts += 1;
        setTimeout(tryScroll, 150);
      }
    };
    const timer = setTimeout(tryScroll, 200);
    return () => clearTimeout(timer);
  }, [phase, currentStep]);

  const handleNext = useCallback((...args) => {
    manualNavRef.current = true;
    goNext(...args);
  }, [goNext]);

  const handleBack = useCallback(() => {
    manualNavRef.current = true;
    // If the previous step is the (skipped) welcome-intro-prepare and the user is
    // NOT on the home page, that means the current step is the first visible step of
    // the document-page tour. Going back should return to the welcome overlay bubble
    // instead of the skipped prepare step (which would immediately advance forward).
    if (currentStep > 0) {
      const prevStep = TUTORIAL_STEPS[currentStep - 1];
      if (prevStep?.id === 'welcome-intro-prepare' && !isHomePage(location.pathname)) {
        backToWelcomeOverlay();
        return;
      }
    }
    // If the previous step triggered a navigateOnNext, going back means returning to the
    // origin page. Walk backwards to find the most recent step with a navigateOnNext.
    if (currentStep > 0) {
      const prevStep = TUTORIAL_STEPS[currentStep - 1];
      if (prevStep?.navigateOnNext) {
        // The current page is prevStep.navigateOnNext. To go back we need the page before
        // prevStep — which is wherever DocumentView lives (the document page).
        const params = new URLSearchParams(window.location.search);
        const documentId = params.get('id');
        const url = documentId ? `/DocumentView?id=${documentId}` : '/DocumentView';
        setNavPending(true);
        navigate(url);
      }
    }
    goBack();
  }, [goBack, currentStep, navigate, backToWelcomeOverlay, location.pathname]);

  // On every page navigation: immediately suppress tooltip, then lift suppression after DOM settles
  useEffect(() => {
    setNavPending(true);
    clearTimeout(navTimerRef.current);
    navTimerRef.current = setTimeout(() => setNavPending(false), NAV_DELAY_MS);
    return () => clearTimeout(navTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ── Auto-scroll to target element on every step change ──────────────────────
  // Mobile ONLY: the bottom sheet is fixed and never scrolls the target into view
  // on its own, so we scroll here — accounting for the sheet height so the target
  // is never hidden behind it. On desktop, TutorialTooltip owns the scroll (it
  // scrolls + measures its own position together), so scrolling here too would
  // cause a competing double-scroll and a mis-placed bubble.
  useEffect(() => {
    if (!isMobile || phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || !step.targetSelector || step.type === 'closing') return;

    const scrollToElement = () => {
      const el = document.querySelector(step.targetSelector);
      if (!el) return;

      const rect = el.getBoundingClientRect();

      // Account for the bottom sheet so the element isn't hidden behind it.
      const sheet = document.querySelector('.tutorial-highlight-bubble');
      const sheetHeight = sheet ? sheet.getBoundingClientRect().height : 260;
      const topMargin = 72; // keep clear of the fixed app header
      const margin = 16;
      const visibleHeight = window.innerHeight - sheetHeight;

      if (rect.bottom > visibleHeight - margin || rect.top < topMargin) {
        let targetY;
        if (rect.height > visibleHeight - topMargin - margin) {
          // Target taller than the visible band → align its top just below the header
          targetY = window.scrollY + rect.top - topMargin;
        } else {
          // Center the target within the band between the header and the sheet
          const bandCenter = topMargin + (visibleHeight - topMargin) / 2;
          targetY = window.scrollY + (rect.top + rect.height / 2) - bandCenter;
        }
        targetY = Math.max(0, targetY);
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    };

    // Wait for the sheet to render so we can measure its height accurately.
    const timer = setTimeout(scrollToElement, 180);
    return () => clearTimeout(timer);
  }, [isMobile, phase, currentStep, navPending]);

  // ── Mobile: add body class for extra bottom scroll space ──────────────────
  useEffect(() => {
    if (isMobile && phase === 'running') {
      document.body.classList.add('tutorial-mobile-active');
    } else {
      document.body.classList.remove('tutorial-mobile-active');
    }
    return () => { document.body.classList.remove('tutorial-mobile-active'); };
  }, [isMobile, phase]);

  // ── Mobile: push fixed version nav bar above the tutorial sheet ──────────
  useEffect(() => {
    if (!isMobile || phase !== 'running') {
      const vl = document.querySelector('.versions-list');
      if (vl) vl.style.bottom = '';
      return;
    }
    const timer = setTimeout(() => {
      const vl = document.querySelector('.versions-list');
      if (!vl) return;
      const sheet = document.querySelector('.tutorial-highlight-bubble');
      const sheetHeight = sheet ? sheet.getBoundingClientRect().height : 220;
      vl.style.bottom = `${sheetHeight}px`;
    }, 150);
    return () => {
      clearTimeout(timer);
      const vl = document.querySelector('.versions-list');
      if (vl) vl.style.bottom = '';
    };
  }, [isMobile, phase, currentStep, navPending]);

  // Reset manualNavRef after each step change
  useEffect(() => {
    manualNavRef.current = false;
  }, [currentStep]);

  // ── Auto-skip the welcome-intro-prepare step when NOT on the home page ──────
  // This step targets the group header and only makes sense in the home→group→document
  // flow. When the tour starts directly on a document page (e.g. an unauthenticated
  // user clicking "Tour the platform" from a document), step 0 is this prepare step
  // and must be advanced automatically. Doing this in an effect (not during render)
  // ensures the state update reliably fires and the next bubble appears.
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (step?.id === 'welcome-intro-prepare' && !isHomePage(location.pathname)) {
      handleNext();
    }
  }, [phase, currentStep, location.pathname, handleNext]);

  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || !step.targetSelector || step.type === 'closing') return;

    // 'explain' and 'encourage' steps must NEVER be auto-skipped —
    // the user must click Next/Back to move through them.
    if (step.type === 'explain' || step.type === 'encourage') return;

    // Don't auto-skip when the user is on a different page than the step expects
    // — the bubble is hidden and will reappear when they return to the relevant page
    const stepPage = getStepPage(step);
    const currentPage = getPageFromPathname(location.pathname);
    if (stepPage && currentPage !== stepPage) return;

    // For practice steps only: auto-skip if the target element is genuinely
    // missing from the DOM (e.g. user navigated away from the document page).
    const timer = setTimeout(() => {
      if (manualNavRef.current) return;
      const el = document.querySelector(step.targetSelector);
      if (!el) {
        goNext();
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [phase, currentStep, goNext, location.pathname]);

  // ── Practice pulse on target ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    // No pulse for browse-encourage (section-card is too large for ring animation)
    if (!step || step.type !== 'practice' || step.id === 'browse-encourage') return;

    const el = document.querySelector(step.targetSelector);
    if (!el) return;

    el.classList.add('tutorial-pulse-ring'); // Use CSS animation instead of inline style
    return () => { el.classList.remove('tutorial-pulse-ring'); };
  }, [phase, currentStep, navPending]);

  // ── Highlight target with blue outline for all explain/practice steps ──────
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || !step.targetSelector || step.type === 'closing') return;

    const el = document.querySelector(step.targetSelector);
    if (!el) return;

    el.classList.add('tutorial-highlight-target');
    return () => { el.classList.remove('tutorial-highlight-target'); };
  }, [phase, currentStep, navPending]);

  // ── Handle newclause-explain: force-show the insert-section button ──────────
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || step.id !== 'newclause-explain') return;

    // Find the first .section-insert-space and force-reveal its inner button
    const insertSpace = document.querySelector('.section-insert-space');
    if (!insertSpace) return;

    // Add class to force-reveal
    insertSpace.classList.add('tutorial-force-insert-visible');

    return () => {
      insertSpace.classList.remove('tutorial-force-insert-visible');
    };
  }, [phase, currentStep, navPending]);

  // ── Derive ghost voting state ─────────────────────────────────────────────
  const showGhostVoting = phase === 'running' && TUTORIAL_STEPS.length > 0 && (() => {
    const step = TUTORIAL_STEPS[currentStep];
    return step && (step.id === 'vote-explain' || step.id === 'support-threshold-explain');
  })();

  // ── Derive ghost points state (show when not authenticated and at points-explain step) ──
  const showGhostPoints = phase === 'running' && TUTORIAL_STEPS.length > 0 && !isAuthenticated && (() => {
    const step = TUTORIAL_STEPS[currentStep];
    return step && (step.id === 'points-explain' || step.id === 'points-ranking-explain');
  })();

  // ── Handle browse-explain: pulse carousel nav area when no suggestions exist ──
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || step.id !== 'browse-explain') return;

    // Check if there are any pending suggestions (carousel nav arrows are shown only when pendingSuggestions > 0)
    const navArrows = document.querySelector('.proposal-navigation-arrows');
    if (navArrows) return; // arrows exist — no need to ghost-pulse

    // Find the section card and add a ghost nav area
    const sectionCard = document.querySelector('.section-card');
    if (!sectionCard) return;

    // Create a ghost nav bar that mimics the real one but is visually "empty".
    // Carries the `.proposal-navigation-arrows` class so the tutorial tooltip's
    // scroll/spotlight targets it exactly like the real buttons. Appended to the
    // bottom of the card to match the real buttons' location.
    const ghost = window.document.createElement('div');
    ghost.className = 'proposal-navigation-arrows tutorial-ghost-nav';
    ghost.setAttribute('data-tutorial-ghost', 'true');
    const navLabel = language === 'he'
      ? 'הצעה קודמת / הבאה'
      : language === 'ar'
      ? 'الاقتراح السابق / التالي'
      : 'Previous / Next suggestion';
    ghost.innerHTML = `
      <div class="tutorial-ghost-nav-inner">
        <div class="tutorial-ghost-btn">‹</div>
        <span class="tutorial-ghost-nav-label">${navLabel}</span>
        <div class="tutorial-ghost-btn">›</div>
      </div>
    `;
    sectionCard.appendChild(ghost);

    return () => {
      const g = sectionCard.querySelector('[data-tutorial-ghost="true"]');
      if (g) g.remove();
    };
  }, [phase, currentStep, navPending, language]);

  // ── Handle editclause-hover: reset carousel and show edit buttons ──────────
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || step.id !== 'editclause-hover') return;

    // Reset carousel to original section view (if any carousel exists)
    const carouselCurrentView = document.querySelector('[data-testid="carousel-current-view"]');
    if (carouselCurrentView) {
      // Dispatch a custom event to force carousel back to current view
      window.dispatchEvent(new CustomEvent('tutorial:resetCarousel'));
    }

    // Hover on section-card to reveal edit/delete buttons
    const sectionCard = document.querySelector('.section-card');
    if (sectionCard) {
      // Simulate hover state by adding a class or setting inline style
      sectionCard.style.pointerEvents = 'none'; // Prevent actual hover interference
      
      // Reveal edit/delete buttons by simulating hover
      const editDeleteButtons = sectionCard.querySelector('[class*="opacity-0"][class*="group-hover"]');
      if (editDeleteButtons) {
        editDeleteButtons.style.opacity = '1';
      }

      // Clean up on unmount
      return () => {
        sectionCard.style.pointerEvents = '';
        if (editDeleteButtons) {
          editDeleteButtons.style.opacity = '';
        }
      };
    }
  }, [phase, currentStep, navPending]);

  // Memoized skip confirm dialog
  const SkipConfirmDialog = React.useMemo(() => showSkipConfirm ? (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-6 flex flex-col gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <p className="text-slate-800 font-semibold text-center text-base">
        {language === 'he' ? 'לעצור את הסיור?' : language === 'ar' ? 'إيقاف الجولة؟' : 'Stop the tour?'}
      </p>
      <p className="text-slate-500 text-sm text-center">
        {language === 'he'
          ? 'אפשר להשהות ולחזור לאותו השלב בהמשך, או לסיים לגמרי.'
          : language === 'ar'
          ? 'يمكنك الإيقاف المؤقت والعودة إلى نفس الخطوة لاحقاً، أو الخروج نهائياً.'
          : 'You can pause and resume from the same step later, or exit completely.'}
      </p>
      <div className="flex flex-col gap-2">
        <button
          className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm"
          onClick={() => setShowSkipConfirm(false)}
        >
          {language === 'he' ? 'המשך סיור' : language === 'ar' ? 'متابعة الجولة' : 'Continue tour'}
        </button>
        <button
          className="w-full px-4 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium text-sm"
          onClick={() => { setShowSkipConfirm(false); pauseTutorial(); }}
        >
          {language === 'he' ? 'השהה וחזור בהמשך' : language === 'ar' ? 'إيقاف مؤقت والعودة لاحقاً' : 'Pause & resume later'}
        </button>
        <button
          className="w-full px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium text-sm"
          onClick={() => { setShowSkipConfirm(false); skipTutorial(); }}
        >
          {language === 'he' ? 'סיים לגמרי' : language === 'ar' ? 'خروج نهائي' : 'Exit completely'}
        </button>
      </div>
    </div>
    </div>
  ) : null, [showSkipConfirm, isRTL, language, skipTutorial, pauseTutorial]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === 'idle' || phase === 'done') return null;

  // Persistent points-info modal — rendered at the top level (outside the running
  // block) so it survives when the tutorial layer hides itself while a dialog is open.
  const pointsModal = (
    <PointsInfoModal open={showPointsModal} onClose={() => setShowPointsModal(false)} />
  );

  // welcome-overlay: centered welcome bubble — always shown first before the tour begins
  if (phase === 'welcome-overlay') {
    const handleWelcomeStart = () => {
      // If the tour was started from a document page, stay on it and begin there.
      // Otherwise, redirect to the home page to start from home-intro.
      const onDocument = isDocumentPage(location.pathname);
      if (!onDocument && !isHomePage(location.pathname)) {
        navigate('/');
      }
      beginFromWelcomeOverlay();
      // Flag that we just started from the welcome overlay so the running-phase
      // scroll effect force-scrolls to the first visible step's target.
      justStartedRef.current = true;
    };
    return (
      <TutorialWelcomeOverlay
        onStart={handleWelcomeStart}
        onSkip={skipTutorial}
        isRTL={isRTL}
      />
    );
  }

  // welcome-intro: small bubble shown after delay when user is authenticated
  if (phase === 'welcome-intro') {
    return (
      <TutorialWelcomeBubble
        onStart={beginFromWelcome}
        onSkip={skipTutorial}
        isRTL={isRTL}
        language={language}
        delay={15000}
      />
    );
  }

  // welcome: small bubble pointing to sidebar tour button (shown after delay for new users)
  if (phase === 'welcome') {
    return (
      <TutorialWelcomeBubble
        onStart={beginFromWelcome}
        onSkip={skipTutorial}
        isRTL={isRTL}
        language={language}
        delay={10000}
      />
    );
  }

  if (phase === 'home-intro') {
    // On group page — show group documents step directly
    if (isGroupPage(location.pathname)) {
      return (
        <>
          {SkipConfirmDialog}
          <TutorialHomeIntro
            step={GROUP_INTRO_STEP}
            onSkip={skipTutorial}
            onRequestSkip={() => setShowSkipConfirm(true)}
            isRTL={isRTL}
            ctaText={language === 'he' ? 'בחרו מסמך ונמשיך' : language === 'ar' ? 'اختر وثيقة للمتابعة' : 'Click on a document to continue'}
          />
        </>
      );
    }
    if (isHomePage(location.pathname)) {
      return (
        <>
          {SkipConfirmDialog}
          <TutorialHomeIntro
            step={HOME_INTRO_STEP}
            onSkip={skipTutorial}
            onRequestSkip={() => setShowSkipConfirm(true)}
            isRTL={isRTL}
            ctaText={language === 'he' ? 'בחרו קבוצה ונמשיך' : language === 'ar' ? 'اختر مجموعة للمتابعة' : 'Click on a group to continue'}
          />
        </>
      );
    }
    // On any other page — show a "Return to tour" button so the user can get back
    return (
      <>
        {SkipConfirmDialog}
        <TutorialReturnButton targetPage="home" isRTL={isRTL} />
      </>
    );
  }

  if (phase === 'running') {
    if (!TUTORIAL_STEPS.length) return null;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step) return null;

    // Skip welcome-intro-prepare if not on home page — the auto-skip effect above
    // advances the step; render nothing until it does.
    if (step.id === 'welcome-intro-prepare' && !isHomePage(location.pathname)) {
      return null;
    }

    // If the step is associated with a specific page and the user is on a
    // different page, hide the bubble — it will reappear when they return.
    const stepPage = getStepPage(step);
    const currentPage = getPageFromPathname(location.pathname);
    if (stepPage && currentPage !== stepPage) {
      return (
        <>
          {SkipConfirmDialog}
          <TutorialReturnButton
            targetPage={stepPage}
            documentId={lastDocumentIdRef.current}
            isRTL={isRTL}
          />
        </>
      );
    }

    // Suppress rendering while waiting for a navigated page to settle
    if (navPending) return null;

    // Suppress overlay/tooltip while any modal dialog is open — but keep the
    // points-info modal mounted so clicking the ghost badge actually shows it.
    if (modalOpen) return pointsModal;

    const overlaySelector = step.targetSelector;
    const additionalSpotlights = step.additionalSpotlights || [];

    const handleNextStep = () => {
      // ── Side-effects that must happen BEFORE advancing the step index ──────
      if (step.actionOnNext === 'navigateOlderVersion') {
        // Click the "older version" button directly — same as a real user click.
        const olderBtn = document.querySelector('.versions-older-btn');
        if (olderBtn && !olderBtn.disabled) {
          olderBtn.click();
        } else {
          window.dispatchEvent(new CustomEvent('tutorial:navigateOlderVersion'));
        }
      }

      if (step.actionOnNext === 'expandProposal') {
        const sectionCard = document.querySelector('.section-card');
        if (sectionCard) {
          const expandBtn = sectionCard.querySelector('[data-expand-proposal]');
          if (expandBtn) expandBtn.click();
        }
      }

      if (step.navigateOnNext) {
        // Close any open modal first
        window.dispatchEvent(new CustomEvent('tutorial:closeModal'));
        // Preserve current documentId query param if present
        const params = new URLSearchParams(window.location.search);
        const documentId = params.get('id');
        const url = documentId
          ? `/${step.navigateOnNext}?id=${documentId}`
          : `/${step.navigateOnNext}`;
        // Suppress tooltip until new page DOM is ready
        setNavPending(true);
        navigate(url);
      }

      // Advance step index — tooltip will be suppressed by navPending if we navigated
      handleNext();
    };

    // Tour summary step — full dark overlay, no spotlight, tooltip centered
    if (step.id === 'tour-summary') {
      const summaryProps = {
        step, stepIndex: currentStep, totalSteps: TUTORIAL_STEPS.length,
        onNext: handleNextStep, onBack: handleBack, onSkip: skipTutorial,
        practiceCompleted, showSuccess, showSignupPrompt, isAuthenticated,
        isRTL, isSummary: true, onRequestSkip: () => setShowSkipConfirm(true),
      };
      return (
        <>
          {SkipConfirmDialog}
          <div className="fixed inset-0 z-[10001] bg-black/70 pointer-events-none" aria-hidden="true" />
          {isMobile ? (
            <TutorialMobileSheet {...summaryProps} />
          ) : (
            <TutorialTooltip {...summaryProps} />
          )}
        </>
      );
    }

    // Interstitial step — centered bubble with dimmed scrim, no spotlight
    if (step.isInterstitial) {
      const interstitialProps = {
        step, stepIndex: currentStep, totalSteps: TUTORIAL_STEPS.length,
        onNext: handleNextStep, onBack: handleBack, onSkip: skipTutorial,
        practiceCompleted, showSuccess, showSignupPrompt, isAuthenticated,
        isRTL, isInterstitial: true, onRequestSkip: () => setShowSkipConfirm(true),
      };
      return (
        <>
          {SkipConfirmDialog}
          <div className="fixed inset-0 z-[10001] bg-black/70 pointer-events-none" aria-hidden="true" />
          <TutorialTooltip {...interstitialProps} />
        </>
      );
    }

    const sharedTooltipProps = {
      step,
      stepIndex: currentStep,
      totalSteps: TUTORIAL_STEPS.length,
      onNext: handleNextStep,
      onBack: handleBack,
      onSkip: skipTutorial,
      practiceCompleted,
      showSuccess,
      showSignupPrompt,
      isAuthenticated,
      isRTL,
      onOpenPointsModal: () => setShowPointsModal(true),
      onRequestSkip: () => setShowSkipConfirm(true),
    };

    return (
      <>
        {SkipConfirmDialog}
        {showGhostVoting && <TutorialGhostVoting showNavArrows={TUTORIAL_STEPS[currentStep]?.id === 'vote-explain'} />}
        {showGhostPoints && <TutorialGhostPoints />}
        <TutorialOverlay targetSelector={overlaySelector} additionalSpotlights={additionalSpotlights} />
        {isMobile ? (
          <TutorialMobileSheet {...sharedTooltipProps} />
        ) : (
          <TutorialTooltip {...sharedTooltipProps} />
        )}
        {pointsModal}
      </>
    );
  }

  return null;
}