import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTutorial } from './useTutorial';
import { TUTORIAL_STEPS, HOME_INTRO_STEP } from './tutorialSteps';
import TutorialWelcome from './TutorialWelcome';
import TutorialOverlay from './TutorialOverlay';
import TutorialTooltip from './TutorialTooltip';
import TutorialHomeIntro from './TutorialHomeIntro';
import { useLanguage } from '@/components/LanguageContext';

function isDocumentPage(pathname) {
  // Document pages typically contain /DocumentView or /document in the path
  return /\/(DocumentView|document)/i.test(pathname) || pathname.includes('urlName');
}

function isHomePage(pathname) {
  return pathname === '/' || pathname === '/Home' || pathname === '';
}

export default function TutorialController() {
  const { isRTL } = useLanguage();
  const location = useLocation();

  const {
    phase,
    currentStep,
    totalSteps,
    homeStepSeen,
    practiceCompleted,
    showSuccess,
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

  // ── Resume when navigating TO a document page from home-intro ───────────
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

  // ── Practice pulse on target ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || step.type !== 'practice') return;

    const el = document.querySelector(step.targetSelector);
    if (!el) return;

    el.style.animation = 'tutorial-pulse-ring 1.5s ease-out infinite';
    return () => { el.style.animation = ''; };
  }, [phase, currentStep]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === 'idle' || phase === 'done') return null;

  if (phase === 'welcome') {
    return (
      <TutorialWelcome
        onStart={beginFromWelcome}
        onSkip={skipTutorial}
        isRTL={isRTL}
      />
    );
  }

  if (phase === 'home-intro') {
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

    return (
      <TutorialOverlay targetSelector={step.targetSelector}>
        <TutorialTooltip
          step={step}
          stepIndex={currentStep}
          totalSteps={TUTORIAL_STEPS.length}
          onNext={goNext}
          onBack={goBack}
          onSkip={skipTutorial}
          practiceCompleted={practiceCompleted}
          showSuccess={showSuccess}
          isRTL={isRTL}
        />
      </TutorialOverlay>
    );
  }

  return null;
}