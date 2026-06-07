import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'consenz_tutorial';

const defaultState = () => ({
  active: false,
  homeStepSeen: false,
  currentStep: 0,
  completedSteps: [],
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * phase: 'idle' | 'welcome' | 'home-intro' | 'running' | 'done'
 *
 * Entry points:
 *  - 'home' entry: welcome → home-intro → (user clicks doc) → running
 *  - 'document' entry: welcome → running directly (skip home-intro)
 */
export function useTutorial(steps = []) {
  const [state, setState] = useState(loadState);
  const [phase, setPhase] = useState('idle');
  const [practiceCompleted, setPracticeCompleted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // On mount: resume if tutorial was active
  useEffect(() => {
    const s = loadState();
    if (!s.active || steps.length === 0) return;
    setState(s);
    if (s.currentStep < steps.length) {
      setPhase('running');
    }
  }, [steps.length]);

  // Persist on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Listen for practice completion events (document steps only)
  useEffect(() => {
    if (phase !== 'running' || !steps.length) return;
    const step = steps[state.currentStep];
    if (!step || step.type !== 'practice' || !step.completionEvent) return;

    setPracticeCompleted(false);
    const handler = () => setPracticeCompleted(true);
    window.addEventListener(step.completionEvent, handler);
    return () => window.removeEventListener(step.completionEvent, handler);
  }, [phase, state.currentStep, steps]);

  // Listen for home-intro completion event
  useEffect(() => {
    if (phase !== 'home-intro') return;

    const handler = () => {
      setState(prev => {
        const next = { ...prev, homeStepSeen: true };
        saveState(next);
        return next;
      });
      // Don't change phase here — TutorialController handles page transition
    };
    window.addEventListener('document:entered', handler);
    return () => window.removeEventListener('document:entered', handler);
  }, [phase]);

  // ─── Public actions ────────────────────────────────────────────────────────

  /**
   * Called at session start.
   * entryPoint: 'home' | 'document'
   */
  const startTutorial = useCallback((entryPoint = 'document') => {
    const fresh = defaultState();
    fresh.active = true;
    saveState(fresh);
    setState(fresh);
    setPracticeCompleted(false);
    setShowSuccess(false);
    setPhase('welcome');
    // Store entry point for beginFromWelcome to use
    startTutorial._entryPoint = entryPoint;
  }, []);

  const beginFromWelcome = useCallback(() => {
    const entryPoint = startTutorial._entryPoint || 'document';
    if (entryPoint === 'home') {
      setPhase('home-intro');
    } else {
      setState(prev => {
        const next = { ...prev, active: true };
        saveState(next);
        return next;
      });
      setPhase('running');
    }
  }, [startTutorial]);

  /**
   * Called when navigating to a document page.
   * If tutorial is in home-intro phase (homeStepSeen just became true), resume.
   */
  const resumeOnDocumentPage = useCallback(() => {
    const s = loadState();
    if (s.active && s.homeStepSeen && s.currentStep < steps.length) {
      setState(s);
      setPhase('running');
    }
  }, [steps.length]);

  const skipTutorial = useCallback(() => {
    const done = { ...defaultState(), active: false };
    setState(done);
    saveState(done);
    setPhase('idle');
    setPracticeCompleted(false);
    setShowSuccess(false);
  }, []);

  const goNext = useCallback(() => {
    const step = steps[state.currentStep];
    if (!step) return;

    if (step.type === 'practice' && !practiceCompleted) return;

    if (step.type === 'practice' && practiceCompleted && !showSuccess) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setPracticeCompleted(false);
        setState(prev => {
          const nextIdx = prev.currentStep + 1;
          if (nextIdx >= steps.length) {
            const done = { ...prev, active: false, currentStep: nextIdx, completedSteps: [...prev.completedSteps, prev.currentStep] };
            saveState(done);
            setPhase('done');
            return done;
          }
          const next = { ...prev, currentStep: nextIdx, completedSteps: [...prev.completedSteps, prev.currentStep] };
          saveState(next);
          return next;
        });
      }, 1800);
      return;
    }

    setState(prev => {
      const nextIdx = prev.currentStep + 1;
      if (nextIdx >= steps.length) {
        const done = { ...prev, active: false, currentStep: nextIdx, completedSteps: [...prev.completedSteps, prev.currentStep] };
        saveState(done);
        setPhase('done');
        return done;
      }
      const next = { ...prev, currentStep: nextIdx, completedSteps: [...prev.completedSteps, prev.currentStep] };
      saveState(next);
      return next;
    });
  }, [state.currentStep, steps, practiceCompleted, showSuccess]);

  const goBack = useCallback(() => {
    setState(prev => {
      if (prev.currentStep === 0) return prev;
      const next = { ...prev, currentStep: prev.currentStep - 1 };
      saveState(next);
      return next;
    });
    setPracticeCompleted(false);
    setShowSuccess(false);
  }, []);

  const restartTutorial = useCallback((entryPoint = 'document') => {
    startTutorial(entryPoint);
  }, [startTutorial]);

  return {
    phase,
    currentStep: state.currentStep,
    homeStepSeen: state.homeStepSeen,
    completedSteps: state.completedSteps,
    practiceCompleted,
    showSuccess,
    startTutorial,
    beginFromWelcome,
    resumeOnDocumentPage,
    skipTutorial,
    goNext,
    goBack,
    restartTutorial,
    totalSteps: steps.length,
  };
}