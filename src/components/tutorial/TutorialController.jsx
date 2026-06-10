import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTutorial } from './useTutorial';
import { TUTORIAL_STEPS, HOME_INTRO_STEP, GROUP_INTRO_STEP, GROUP_EXPLAIN_STEP } from './tutorialSteps';
import TutorialWelcomeBubble from './TutorialWelcomeBubble';
import TutorialWelcome from './TutorialWelcome';
import TutorialOverlay from './TutorialOverlay';
import TutorialTooltip from './TutorialTooltip';
import TutorialHomeIntro from './TutorialHomeIntro';
import TutorialGhostVoting from './TutorialGhostVoting';
import TutorialMobileSheet from './TutorialMobileSheet';
import PointsInfoModal from '@/components/points/PointsInfoModal';
import { useLanguage } from '@/components/LanguageContext';

// Detect mobile viewport (≤768px)
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth <= 768);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// How long to suppress tooltip rendering after a navigation action (ms).
// Gives the new page time to mount and render its DOM before we try to find target elements.
const NAV_DELAY_MS = 600;

function isDocumentPage(pathname) {
  return /\/(DocumentView|document)/i.test(pathname) || pathname.includes('urlName');
}

function isHomePage(pathname) {
  return pathname === '/' || pathname === '/Home' || pathname === '';
}

function isGroupPage(pathname) {
  return /\/GroupView/i.test(pathname) || /\/group/i.test(pathname);
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

  // Suppress tutorial overlay/tooltip when any app modal is open
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    function checkModal() {
      const hasModal = !!(
        document.querySelector('[role="dialog"][data-state="open"]') ||
        document.querySelector('[data-radix-dialog-overlay]') ||
        document.querySelector('[data-radix-alert-dialog-overlay]')
      );
      setModalOpen(hasModal);
    }
    checkModal();
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
    return () => observer.disconnect();
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
    startTutorial,
    beginFromWelcome,
    resumeOnDocumentPage,
    skipTutorial,
    goNext,
    goBack,
    restartTutorial,
  } = useTutorial(TUTORIAL_STEPS);

  // ── Session-start detection ──────────────────────────────────────────────
  useEffect(() => {
    // Only trigger on first session load (idle phase)
    if (phase !== 'idle') return;

    // Check if tutorial has already been completed/skipped
    try {
      const raw = localStorage.getItem('consenz_tutorial');
      if (raw) {
        const saved = JSON.parse(raw);
        // If explicitly marked inactive (skipped or done), don't auto-start
        if (saved.active === false && saved.currentStep > 0) return;
        // Resume mid-tutorial if active
        if (saved.active === true) return; // useTutorial mount effect handles this
      }
    } catch {}

    // First ever visit — auto-start
    const entry = isDocumentPage(location.pathname) ? 'document' : 'home';
    startTutorial(entry);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

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

  // ── Expose restart globally ──────────────────────────────────────────────
  useEffect(() => {
    window.restartTutorial = (entryPoint) =>
      restartTutorial(entryPoint || (isHomePage(location.pathname) ? 'home' : 'document'));
    return () => { delete window.restartTutorial; };
  }, [restartTutorial, location.pathname]);

  // ── Skip missing target elements ────────────────────────────────────────────
  const manualNavRef = useRef(false);

  const handleNext = useCallback((...args) => {
    manualNavRef.current = true;
    goNext(...args);
  }, [goNext]);

  const handleBack = useCallback(() => {
    manualNavRef.current = true;
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
  }, [goBack, currentStep, navigate]);

  // On every page navigation: immediately suppress tooltip, then lift suppression after DOM settles
  useEffect(() => {
    setNavPending(true);
    clearTimeout(navTimerRef.current);
    navTimerRef.current = setTimeout(() => setNavPending(false), NAV_DELAY_MS);
    return () => clearTimeout(navTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ── Mobile: auto-scroll to target element on every step change ──────────────────
  useEffect(() => {
    if (!isMobile || phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || !step.targetSelector) return;

    // Poll for element up to 2s
    let attempts = 0;
    const interval = setInterval(() => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        clearInterval(interval);
        // Scroll with offset to keep above the bottom sheet (~180px)
        const rect = el.getBoundingClientRect();
        const sheetHeight = 180;
        const visibleHeight = window.innerHeight - sheetHeight;
        if (rect.top < 0 || rect.bottom > visibleHeight) {
          // For .section-insert-space, scroll to show it properly with some padding
          let targetY = window.scrollY + rect.top - (visibleHeight / 3);
          targetY = Math.max(0, targetY);
          window.scrollTo({ top: targetY, behavior: 'smooth' });
        }
        return;
      }
      attempts++;
      if (attempts >= 10) clearInterval(interval);
    }, 200);

    return () => clearInterval(interval);
  }, [isMobile, phase, currentStep]);

  // Reset manualNavRef after each step change
  useEffect(() => {
    manualNavRef.current = false;
  }, [currentStep]);

  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || !step.targetSelector || step.type === 'closing') return;

    // 'explain' and 'encourage' steps must NEVER be auto-skipped —
    // the user must click Next/Back to move through them.
    if (step.type === 'explain' || step.type === 'encourage') return;

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
  }, [phase, currentStep, goNext]);

  // ── Practice pulse on target ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    // No pulse for browse-encourage (section-card is too large for ring animation)
    if (!step || step.type !== 'practice' || step.id === 'browse-encourage') return;

    const el = document.querySelector(step.targetSelector);
    if (!el) return;

    el.style.animation = 'tutorial-pulse-ring 1.5s ease-out infinite';
    return () => { el.style.animation = ''; };
  }, [phase, currentStep]);

  // ── Handle editclause-buttons: force-show edit/delete buttons on section card ──
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || step.id !== 'editclause-buttons') return;

    const actionButtons = document.querySelector('.section-action-buttons');
    if (!actionButtons) return;

    // Add class to force-show the hidden buttons via CSS
    actionButtons.classList.add('tutorial-force-hover');

    // Also inline-override opacity-0 buttons directly
    const overrides = [];
    actionButtons.querySelectorAll('.opacity-0').forEach(el => {
      overrides.push({ el, opacity: el.style.opacity, transition: el.style.transition });
      el.style.opacity = '1';
      el.style.transition = 'none';
    });

    return () => {
      actionButtons.classList.remove('tutorial-force-hover');
      overrides.forEach(({ el, opacity, transition }) => {
        el.style.opacity = opacity;
        el.style.transition = transition;
      });
    };
  }, [phase, currentStep]);

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
  }, [phase, currentStep]);

  // ── Derive ghost voting state ─────────────────────────────────────────────
  const showGhostVoting = phase === 'running' && TUTORIAL_STEPS.length > 0 && (() => {
    const step = TUTORIAL_STEPS[currentStep];
    return step && (step.id === 'vote-explain' || step.id === 'support-threshold-explain');
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

    // Create a ghost nav bar that mimics the real one but is visually "empty"
    const ghost = window.document.createElement('div');
    ghost.className = 'tutorial-ghost-nav';
    ghost.setAttribute('data-tutorial-ghost', 'true');
    ghost.innerHTML = `
      <div class="tutorial-ghost-nav-inner">
        <div class="tutorial-ghost-btn">‹</div>
        <div class="tutorial-ghost-label"></div>
        <div class="tutorial-ghost-btn">›</div>
      </div>
    `;
    sectionCard.prepend(ghost);

    return () => {
      const g = sectionCard.querySelector('[data-tutorial-ghost="true"]');
      if (g) g.remove();
    };
  }, [phase, currentStep]);

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
  }, [phase, currentStep]);

  // ── Skip confirm dialog ────────────────────────────────────────────────────
  const SkipConfirmDialog = showSkipConfirm ? (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-6 flex flex-col gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <p className="text-slate-800 font-semibold text-center text-base">
          {isRTL ? 'לסיים את הסיור?' : 'Exit the tour?'}
        </p>
        <p className="text-slate-500 text-sm text-center">
          {isRTL ? 'תמיד אפשר להתחיל אותו מחדש מתפריט הניווט.' : 'You can always restart it from the navigation menu.'}
        </p>
        <div className="flex gap-2">
          <button
            className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm"
            onClick={() => setShowSkipConfirm(false)}
          >
            {isRTL ? 'המשך סיור' : 'Continue'}
          </button>
          <button
            className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium text-sm"
            onClick={() => { setShowSkipConfirm(false); skipTutorial(); }}
          >
            {isRTL ? 'סיים' : 'Exit'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === 'idle' || phase === 'done') return null;

  // welcome-intro: full-screen modal shown immediately when tour starts, regardless of page
  if (phase === 'welcome-intro') {
    return (
      <TutorialWelcome
        onStart={beginFromWelcome}
        onSkip={skipTutorial}
        isRTL={isRTL}
        language={language}
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
            ctaText={isRTL ? 'בחרו מסמך ונמשיך' : 'Click on a document to continue'}
          />
        </>
      );
    }
    return (
      <>
        {SkipConfirmDialog}
        <TutorialHomeIntro
          step={HOME_INTRO_STEP}
          onSkip={skipTutorial}
          onRequestSkip={() => setShowSkipConfirm(true)}
          isRTL={isRTL}
          ctaText={isRTL ? 'בחרו קבוצה ונמשיך' : 'Click on a group to continue'}
        />
      </>
    );
  }

  if (phase === 'running') {
    if (!TUTORIAL_STEPS.length) return null;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step) return null;

    // Suppress rendering while waiting for a navigated page to settle
    if (navPending) return null;

    // Suppress overlay/tooltip while any modal dialog is open
    if (modalOpen) return null;

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
        {!isMobile && <TutorialOverlay targetSelector={overlaySelector} additionalSpotlights={additionalSpotlights} />}
        {isMobile ? (
          <TutorialMobileSheet {...sharedTooltipProps} />
        ) : (
          <TutorialTooltip {...sharedTooltipProps} />
        )}
        <PointsInfoModal open={showPointsModal} onClose={() => setShowPointsModal(false)} />
      </>
    );
  }

  return null;
}