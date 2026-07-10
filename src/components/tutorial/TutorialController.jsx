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
    resumeOnDocumentPage,
    skipTutorial,
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

    const scrollToElement = () => {
      const el = document.querySelector(step.targetSelector);
      if (!el) return;

      // Measure actual mobile sheet height — falls back if not yet rendered
      const sheet = document.querySelector('.tutorial-highlight-bubble');
      const sheetHeight = sheet ? sheet.getBoundingClientRect().height : 220;
      const margin = 12;
      const visibleHeight = window.innerHeight - sheetHeight;

      const rect = el.getBoundingClientRect();
      // Scroll if the element's bottom is below the visible area (hidden behind sheet)
      // or its top is above the viewport
      if (rect.bottom > visibleHeight - margin || rect.top < 0) {
        let targetY;
        if (rect.height > visibleHeight - margin) {
          // Element taller than visible area — align top near viewport top
          targetY = window.scrollY + rect.top - 8;
        } else {
          // Position element bottom just above the sheet
          targetY = window.scrollY + rect.bottom - visibleHeight + margin;
        }
        targetY = Math.max(0, targetY);
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    };

    // Delay slightly so the mobile sheet has rendered and can be measured
    const timer = setTimeout(scrollToElement, 120);
    return () => clearTimeout(timer);
  }, [isMobile, phase, currentStep]);

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

    el.classList.add('tutorial-pulse-ring'); // Use CSS animation instead of inline style
    return () => { el.classList.remove('tutorial-pulse-ring'); };
  }, [phase, currentStep]);

  // ── Highlight target with blue outline for all explain/practice steps ──────
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || !step.targetSelector || step.type === 'closing') return;

    const el = document.querySelector(step.targetSelector);
    if (!el) return;

    el.classList.add('tutorial-highlight-target');
    return () => { el.classList.remove('tutorial-highlight-target'); };
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

  // ── Derive ghost points state (show when not authenticated and at points-explain step) ──
  const showGhostPoints = phase === 'running' && TUTORIAL_STEPS.length > 0 && !isAuthenticated && (() => {
    const step = TUTORIAL_STEPS[currentStep];
    return step && step.id === 'points-explain';
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

  // Memoized skip confirm dialog
  const SkipConfirmDialog = React.useMemo(() => showSkipConfirm ? (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-6 flex flex-col gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <p className="text-slate-800 font-semibold text-center text-base">
        {language === 'he' ? 'לסיים את הסיור?' : language === 'ar' ? 'إغلاق الجولة؟' : 'Exit the tour?'}
      </p>
      <p className="text-slate-500 text-sm text-center">
        {language === 'he' ? 'תמיד אפשר להתחיל אותו מחדש מתפריט הניווט.' : language === 'ar' ? 'يمكنك دائماً إعادة تشغيله من قائمة التנקל.' : 'You can always restart it from the navigation menu.'}
      </p>
      <div className="flex gap-2">
        <button
          className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm"
          onClick={() => setShowSkipConfirm(false)}
        >
          {language === 'he' ? 'המשך סיור' : language === 'ar' ? 'متابعة' : 'Continue'}
        </button>
        <button
          className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium text-sm"
          onClick={() => { setShowSkipConfirm(false); skipTutorial(); }}
        >
          {language === 'he' ? 'סיים' : language === 'ar' ? 'خروج' : 'Exit'}
        </button>
      </div>
    </div>
    </div>
  ) : null, [showSkipConfirm, isRTL, language, skipTutorial]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === 'idle' || phase === 'done') return null;

  // welcome-overlay: centered welcome bubble — always shown first before the tour begins
  if (phase === 'welcome-overlay') {
    const handleWelcomeStart = () => {
      // Redirect to home page if not already there
      if (!isHomePage(location.pathname)) {
        navigate('/');
      }
      beginFromWelcomeOverlay();
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

  if (phase === 'running') {
    if (!TUTORIAL_STEPS.length) return null;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step) return null;

    // Skip welcome-intro-prepare if not on home page
    if (step.id === 'welcome-intro-prepare' && !isHomePage(location.pathname)) {
      handleNext();
      return null;
    }

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
        {showGhostPoints && <TutorialGhostPoints />}
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