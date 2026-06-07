import React, { useEffect } from 'react';
import { useTutorial } from './useTutorial';
import { TUTORIAL_STEPS } from './tutorialSteps';
import TutorialWelcome from './TutorialWelcome';
import TutorialOverlay from './TutorialOverlay';
import TutorialTooltip from './TutorialTooltip';
import { useLanguage } from '@/components/LanguageContext';

/**
 * Drop this anywhere in the app tree (e.g., Layout).
 * Exposes window.restartTutorial() for external triggering.
 */
export default function TutorialController() {
  const { isRTL } = useLanguage();

  const {
    phase,
    currentStep,
    totalSteps,
    practiceCompleted,
    showSuccess,
    startTutorial,
    beginFromWelcome,
    skipTutorial,
    goNext,
    goBack,
    restartTutorial,
  } = useTutorial(TUTORIAL_STEPS);

  // Expose restartTutorial globally
  useEffect(() => {
    window.restartTutorial = restartTutorial;
    return () => { delete window.restartTutorial; };
  }, [restartTutorial]);

  // Apply pulsing ring to target on practice steps
  useEffect(() => {
    if (phase !== 'running' || !TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStep];
    if (!step || step.type !== 'practice') return;

    const el = document.querySelector(step.targetSelector);
    if (!el) return;

    const computedRadius = window.getComputedStyle(el).borderRadius || '8px';
    el.style.borderRadius = computedRadius;
    el.classList.add('tutorial-spotlight-pulse');
    el.style.animation = 'tutorial-pulse-ring 1.5s ease-out infinite';

    return () => {
      el.classList.remove('tutorial-spotlight-pulse');
      el.style.animation = '';
    };
  }, [phase, currentStep]);

  if (phase === 'idle' || phase === 'done' || TUTORIAL_STEPS.length === 0) return null;

  if (phase === 'welcome') {
    return (
      <TutorialWelcome
        onStart={beginFromWelcome}
        onSkip={skipTutorial}
        isRTL={isRTL}
      />
    );
  }

  if (phase === 'running') {
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