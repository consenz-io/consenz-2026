import React, { useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTutorial } from './useTutorial';
import { TUTORIAL_STEPS, HOME_INTRO_STEP, GROUP_INTRO_STEP, GROUP_EXPLAIN_STEP } from './tutorialSteps';
import TutorialWelcome from './TutorialWelcome';
import TutorialOverlay from './TutorialOverlay';
import TutorialTooltip from './TutorialTooltip';
import TutorialHomeIntro from './TutorialHomeIntro';
import TutorialClosingScreen from './TutorialClosingScreen';
import { useLanguage } from '@/components/LanguageContext';

function isDocumentPage(pathname) {
  return /\/(DocumentView|document)/i.test(pathname) || pathname.includes('urlName');
}

function isHomePage(pathname) {
  return pathname === '/' || pathname === '/Home' || pathname === '';
}

function isGroupPage(pathname) {
  return /\/GroupView/i.test(pathname);
}

export default function TutorialController() {
  const { isRTL, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

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
  useEffect(() => {
    if ((phase === 'home-intro') && homeStepSeen && isDocumentPage(location.pathname)) {
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

  const handleBack = useCallback((...args) => {
    manualNavRef.current = true;
    goBack(...args);
  }, [goBack]);

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

  // ── Handle modal:new-section-opened → advance to newclause-topic-explain ────
  useEffect(() => {
    if (phase !== 'running') return;
    const newclauseExplainIndex = TUTORIAL_STEPS.findIndex(s => s.id === 'newclause-explain');
    const newclauseTopicIndex = TUTORIAL_STEPS.findIndex(s => s.id === 'newclause-topic-explain');
    const handler = () => {
      // Only auto-advance if we're currently on newclause-explain
      if (currentStep === newclauseExplainIndex) {
        goNext();
      }
    };
    window.addEventListener('modal:new-section-opened', handler);
    return () => window.removeEventListener('modal:new-section-opened', handler);
  }, [phase, currentStep, goNext]);

  // ── Handle newclause-explain: force-show the insert-section button ──────────
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || step.id !== 'newclause-explain') return;

    // Find the first .section-insert-space and force-reveal its inner button
    const insertSpace = document.querySelector('.section-insert-space');
    if (!insertSpace) return;

    const inner = insertSpace.querySelector('.tutorial-force-insert-btn');
    if (inner) {
      inner.style.opacity = '1';
      inner.style.transition = 'none';
    }

    return () => {
      if (inner) {
        inner.style.opacity = '';
        inner.style.transition = '';
      }
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

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === 'idle' || phase === 'done') return null;

  if (phase === 'welcome') {
    return (
      <TutorialWelcome
        onStart={beginFromWelcome}
        onSkip={skipTutorial}
        isRTL={isRTL}
        language={language}
      />
    );
  }

  if (phase === 'home-intro') {
    // On group page — show explain step, then practice step
    if (isGroupPage(location.pathname)) {
      return (
        <TutorialHomeIntro
          step={GROUP_EXPLAIN_STEP}
          nextStep={GROUP_INTRO_STEP}
          onSkip={skipTutorial}
          isRTL={isRTL}
        />
      );
    }
    return (
      <TutorialHomeIntro
        step={HOME_INTRO_STEP}
        onSkip={skipTutorial}
        isRTL={isRTL}
      />
    );
  }

  if (phase === 'running') {
    if (!TUTORIAL_STEPS.length) return null;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step) return null;

    // Closing step — no scrim, no spotlight, fullscreen modal
    if (step.type === 'closing') {
      return (
        <TutorialClosingScreen
          step={step}
          onDone={skipTutorial}
          isRTL={isRTL}
        />
      );
    }

    const overlaySelector = step.targetSelector;

    const handleNextStep = () => {
      // For newclause-explain: clicking Next should open the insert-section modal
      // instead of advancing manually — the modal:new-section-opened event will advance the step
      if (step.id === 'newclause-explain') {
        // Find the actual Button element inside the section-insert-space
        const insertSpace = document.querySelector('.section-insert-space');
        if (insertSpace) {
          const btn = insertSpace.querySelector('button');
          if (btn) {
            btn.click();
            return; // don't call goNext — wait for modal:new-section-opened event
          }
        }
        // Fallback: dispatch event directly to trigger modal open
        window.dispatchEvent(new CustomEvent('tutorial:openNewSectionModal'));
        return;
      }

      if (step.navigateOnNext) {
        // Close any open modal first
        window.dispatchEvent(new CustomEvent('tutorial:closeModal'));
        navigate(`/${step.navigateOnNext}`);
      }
      handleNext();
    };

    // Modal-based steps (e.g., newclause-modal-explain inside CreateSuggestionModal)
    // don't use TutorialOverlay — the modal provides its own backdrop
    const isModalStep = step.id.includes('modal');

    return isModalStep ? (
      <TutorialTooltip
        step={step}
        stepIndex={currentStep}
        totalSteps={TUTORIAL_STEPS.length}
        onNext={handleNextStep}
        onBack={handleBack}
        onSkip={skipTutorial}
        practiceCompleted={practiceCompleted}
        showSuccess={showSuccess}
        showSignupPrompt={showSignupPrompt}
        isAuthenticated={isAuthenticated}
        isRTL={isRTL}
      />
    ) : (
      <TutorialOverlay targetSelector={overlaySelector}>
        <TutorialTooltip
          step={step}
          stepIndex={currentStep}
          totalSteps={TUTORIAL_STEPS.length}
          onNext={handleNextStep}
          onBack={handleBack}
          onSkip={skipTutorial}
          practiceCompleted={practiceCompleted}
          showSuccess={showSuccess}
          showSignupPrompt={showSignupPrompt}
          isAuthenticated={isAuthenticated}
          isRTL={isRTL}
        />
      </TutorialOverlay>
    );
  }

  return null;
}