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
    // non-blocking
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
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const pushTimerRef = useRef(null);

  // Check auth on mount
  useEffect(() => {
    base44.auth.isAuthenticated().then(setIsAuthenticated).catch(() => setIsAuthenticated(false));
  }, []);

  const scheduleServerPush = useCallback((localState) => {
    if (!isAuthenticated) return; // no server sync for anonymous users
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => pushServerTutorialState(localState), 3000);
  }, [isAuthenticated]);

  // On mount: hydrate from server if authenticated and localStorage is empty
  useEffect(() => {
    async function hydrate() {
      const local = loadState();
      const hasLocalData = !!localStorage.getItem(STORAGE_KEY);

      const authed = await base44.auth.isAuthenticated().catch(() => false);
      setIsAuthenticated(authed);

      if (!hasLocalData && authed) {
        const server = await fetchServerTutorialState();
        if (server && !server.tutorialSkipped && !server.tutorialCompleted) {
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
          const done = { ...defaultState(), active: false, currentStep: 1 };
          saveState(done);
          setState(done);
          return;
        }
      }

      // On successful registration: merge localStorage state to server
      if (authed && hasLocalData) {
        const localRaw = loadState();
        // If localStorage has active tutorial data, push it to server
        if (localRaw.active || localRaw.currentStep > 0) {
          pushServerTutorialState(localRaw);
        }
      }

      if (local.active) {
        setState(local);
        if (local.homeStepSeen && local.currentStep < steps.length) {
          setPhase('running');
        } else if (!local.homeStepSeen) {
          // Tutorial is active but user hasn't passed home-intro yet (e.g. navigated
          // to the group page). Stay in home-intro so the correct bubble is shown.
          setPhase('home-intro');
        }
      }
    }
    hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  // Persist on every state change + schedule server push (authenticated only)
  useEffect(() => {
    saveState(state);
    scheduleServerPush(state);
  }, [state, scheduleServerPush]);

  // Listen for practice completion events
  useEffect(() => {
    if (phase !== 'running' || !steps.length) return;
    const step = steps[state.currentStep];
    if (!step || step.type !== 'practice' || !step.completionEvent) return;

    setPracticeCompleted(false);
    setShowSignupPrompt(false);

    const handler = () => {
      // If step requiresAuth and user is not authenticated, show signup prompt instead
      if (step.requiresAuth && !isAuthenticated) {
        setShowSignupPrompt(true);
        return;
      }
      // Keep practiceCompleted true even if signup prompt is already shown
      setPracticeCompleted(true);
    };
    window.addEventListener(step.completionEvent, handler);

    // Also listen for auth-blocked events (triggered by the app when an unauthenticated
    // user tries to perform a gated action)
    const authBlockedHandler = () => {
      if (step.requiresAuth && !isAuthenticated) {
        setShowSignupPrompt(true);
      }
    };
    window.addEventListener('tutorial:auth-required', authBlockedHandler);

    return () => {
      window.removeEventListener(step.completionEvent, handler);
      window.removeEventListener('tutorial:auth-required', authBlockedHandler);
    };
  }, [phase, state.currentStep, steps, isAuthenticated]);

  // Listen for home-intro completion event
  useEffect(() => {
    if (phase !== 'home-intro') return;

    const handler = () => {
      setState(prev => {
        const next = { ...prev, homeStepSeen: true, currentStep: 0 };
        saveState(next);
        return next;
      });
      // Immediately transition to running so welcome-intro is shown on the document page
      setPhase('running');
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
    setShowSignupPrompt(false);
    setPhase('welcome-intro');
    startTutorial._entryPoint = entryPoint;
  }, []);

  const beginFromWelcome = useCallback(() => {
    const entryPoint = startTutorial._entryPoint || 'document';
    if (entryPoint === 'home' || entryPoint === 'group') {
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
    setShowSignupPrompt(false);
    if (isAuthenticated) {
      pushServerTutorialState(done);
      clearTimeout(pushTimerRef.current);
    }
  }, [isAuthenticated]);

  const goNext = useCallback(() => {
    const step = steps[state.currentStep];
    if (!step) return;

    if (step.type === 'practice' && !practiceCompleted) return;

    if (step.type === 'practice' && practiceCompleted && !showSuccess) {
      const stepAtClick = state.currentStep;
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setPracticeCompleted(false);
        setShowSignupPrompt(false);
        setState(prev => {
          // Only advance if we're still on the same step — prevents double-advance
          // if the user clicked Next manually while the success animation was running.
          if (prev.currentStep !== stepAtClick) return prev;
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
    setPracticeCompleted(false);
    setShowSuccess(false);
    setShowSignupPrompt(false);
    setState(prev => {
      if (prev.currentStep === 0) return prev;
      const next = { ...prev, currentStep: prev.currentStep - 1 };
      saveState(next);
      return next;
    });
  }, []);

  const restartTutorial = useCallback((entryPoint = 'document') => {
    // Read currentStep from localStorage — TutorialRestartButton may have pre-set it
    // to a context-appropriate step (e.g. versions-browse-explain on DocumentCleanView).
    const persisted = loadState();
    const fresh = {
      active: true,
      homeStepSeen: entryPoint !== 'home',
      currentStep: persisted.active ? persisted.currentStep : 0,
      completedSteps: [],
    };
    saveState(fresh);
    setState(fresh);
    setPracticeCompleted(false);
    setShowSuccess(false);
    setShowSignupPrompt(false);
    // Skip the welcome-intro screen when restarting manually — go straight to the tour
    setPhase((entryPoint === 'home' || entryPoint === 'group') ? 'home-intro' : 'running');
  }, []);

  return {
    phase,
    currentStep: state.currentStep,
    homeStepSeen: state.homeStepSeen,
    completedSteps: state.completedSteps,
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
    totalSteps: steps.length,
  };
}