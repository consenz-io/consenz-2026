import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'consenz_tutorial';

const defaultState = () => ({
  active: false,
  currentStep: 0,
  completedSteps: [],
  welcomed: false,
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

export function useTutorial(steps = []) {
  const [state, setState] = useState(loadState);
  // phase: 'idle' | 'welcome' | 'running' | 'done'
  const [phase, setPhase] = useState('idle');
  const [practiceCompleted, setPracticeCompleted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // On mount: resume if active and not completed
  useEffect(() => {
    const s = loadState();
    if (s.active && steps.length > 0 && s.currentStep < steps.length) {
      if (!s.welcomed) {
        setPhase('welcome');
      } else {
        setPhase('running');
      }
      setState(s);
    }
  }, [steps.length]);

  // Persist whenever state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Listen for practice completion events
  useEffect(() => {
    if (phase !== 'running' || !steps.length) return;
    const currentStep = steps[state.currentStep];
    if (!currentStep || currentStep.type !== 'practice' || !currentStep.completionEvent) return;

    setPracticeCompleted(false);
    const handler = () => setPracticeCompleted(true);
    window.addEventListener(currentStep.completionEvent, handler);
    return () => window.removeEventListener(currentStep.completionEvent, handler);
  }, [phase, state.currentStep, steps]);

  const startTutorial = useCallback(() => {
    const fresh = { active: true, currentStep: 0, completedSteps: [], welcomed: false };
    setState(fresh);
    saveState(fresh);
    setPhase('welcome');
    setPracticeCompleted(false);
    setShowSuccess(false);
  }, []);

  const beginFromWelcome = useCallback(() => {
    setState(prev => {
      const next = { ...prev, welcomed: true };
      saveState(next);
      return next;
    });
    setPhase('running');
  }, []);

  const skipTutorial = useCallback(() => {
    const done = { active: false, currentStep: 0, completedSteps: [], welcomed: true };
    setState(done);
    saveState(done);
    setPhase('idle');
    setPracticeCompleted(false);
    setShowSuccess(false);
  }, []);

  const goNext = useCallback(() => {
    const currentStep = steps[state.currentStep];
    if (!currentStep) return;

    if (currentStep.type === 'practice' && !practiceCompleted) return;

    if (currentStep.type === 'practice' && practiceCompleted && !showSuccess) {
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

  const restartTutorial = useCallback(() => {
    startTutorial();
  }, [startTutorial]);

  return {
    phase,           // 'idle' | 'welcome' | 'running' | 'done'
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    practiceCompleted,
    showSuccess,
    startTutorial,
    beginFromWelcome,
    skipTutorial,
    goNext,
    goBack,
    restartTutorial,
  };
}