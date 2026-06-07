import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

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

// ─── Server sync helpers ──────────────────────────────────────────────────────

async function fetchServerTutorialState() {
  try {
    const user = await base44.auth.me();
    if (!user) return null;
    const { tutorialCompleted, tutorialLastStep, tutorialSkipped } = user;
    if (tutorialCompleted === undefined && tutorialLastStep === undefined) return null;
    return { tutorialCompleted, tutorialLastStep, tutorialSkipped };
  } catch {
    return null;
  }
}

async function pushServerTutorialState(localState) {
  try {
    const isCompleted = !localState.active && localState.currentStep > 0;
    const isSkipped = !localState.active && localState.currentStep === 0 && localState.completedSteps?.length === 0;
    await base44.auth.updateMe({
      tutorialCompleted: isCompleted,
      tutorialLastStep: localState.currentStep ?? 0,
      tutorialSkipped: isSkipped,
    });
  } catch {
    // non-blocking — local state is source of truth during session
  }
}

/**
 * phase: 'idle' | 'welcome' | 'home-intro' | 'running' | 'done'
 */
export function useTutorial(steps = []) {
  const [state, setState] = useState(loadState);
  const [phase, setPhase] = useState('idle');
  const [practiceCompleted, setPracticeCompleted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Debounced server-push ref
  const pushTimerRef = useRef(null);
  const scheduleServerPush = useCallback((localState) => {
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => pushServerTutorialState(localState), 3000);
  }, []);

  // On mount: hydrate from server if localStorage is empty, then resume if active
  useEffect(() => {
    async function hydrate() {
      const local = loadState();
      const hasLocalData = !!localStorage.getItem(STORAGE_KEY);

      if (!hasLocalData) {
        // Try to hydrate from server
        const server = await fetchServerTutorialState();
        if (server && !server.tutorialSkipped && !server.tutorialCompleted) {
          // Mid-tutorial on another device — resume from server step
          const hydrated = {
            ...defaultState(),
            active: true,
            currentStep: server.tutorialLastStep ?? 0,
            homeStepSeen: true,
          };
          saveState(hydrated);
          setState(hydrated);
          if (steps.length > 0 && hydrated.currentStep < steps.length) {
            setPhase('running');
          }
          return;
        }
        if (server?.tutorialCompleted || server?.tutorialSkipped) {
          // Already done on another device — mark done locally so auto-start skips
          const done = { ...defaultState(), active: false, currentStep: 1 };
          saveState(done);
          setState(done);
          return;
        }
      }

      // Resume active local session
      if (local.active && steps.length > 0 && local.currentStep < steps.length) {
        setState(local);
        setPhase('running');
      }
    }
    hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  // Persist on every state change + schedule server push
  useEffect(() => {
    saveState(state);
    scheduleServerPush(state);
  }, [state, scheduleServerPush]);

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
    };
    window.addEventListener('document:entered', handler);
    return () => window.removeEventListener('document:entered', handler);
  }, [phase]);

  // ─── Public actions ─────────────────────────────────────────────────────────

  const startTutorial = useCallback((entryPoint = 'document') => {
    const fresh = defaultState();
    fresh.active = true;
    saveState(fresh);
    setState(fresh);
    setPracticeCompleted(false);
    setShowSuccess(false);
    setPhase('welcome');
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
    // Immediate server push on explicit skip/complete
    pushServerTutorialState(done);
    clearTimeout(pushTimerRef.current);
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