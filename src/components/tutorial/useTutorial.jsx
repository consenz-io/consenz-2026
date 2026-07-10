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

  // On mount: sync tutorial state to server for authenticated users.
  // New users (no local data AND no server tutorial state) auto-receive the
  // tutorial invitation. Returning users must use the "Tour the platform" button.
  useEffect(() => {
    async function hydrate() {
      const hasLocalData = !!localStorage.getItem(STORAGE_KEY);

      const authed = await base44.auth.isAuthenticated().catch(() => false);
      setIsAuthenticated(authed);

      // Push local state → server (authenticated only)
      if (authed && hasLocalData) {
        const localRaw = loadState();
        if (localRaw.active || localRaw.currentStep > 0) {
          pushServerTutorialState(localRaw);
        }
      }

      if (authed && !hasLocalData) {
        const server = await fetchServerTutorialState();
        if (server?.tutorialCompleted || server?.tutorialSkipped) {
          // Returning user who already completed/skipped — mark done locally
          const done = { ...defaultState(), active: false, currentStep: 1 };
          saveState(done);
          setState(done);
        } else if (server === null) {
          // Truly new user — no tutorial state on server → auto-show invitation
          const fresh = { active: true, homeStepSeen: false, currentStep: 0, completedSteps: [] };
          saveState(fresh);
          setState(fresh);
          setPhase('welcome-overlay');
        }
        // else: server has tutorialLastStep but not completed/skipped — user started
        // but didn't finish. Don't auto-start; let them restart manually if desired.
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

  const entryPointRef = useRef('document');

  const restartTutorial = useCallback((entryPoint = 'document') => {
    const fresh = {
      active: true,
      homeStepSeen: false,
      currentStep: 0,
      completedSteps: [],
    };
    saveState(fresh);
    setState(fresh);
    setPracticeCompleted(false);
    setShowSuccess(false);
    setShowSignupPrompt(false);
    entryPointRef.current = entryPoint;
    // Always show the welcome overlay first — then redirect to home and begin the tour
    setPhase('welcome-overlay');
  }, []);

  const beginFromWelcomeOverlay = useCallback(() => {
    // After the welcome overlay, always go to home-intro so the tour starts from home
    setPhase('home-intro');
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
    beginFromWelcomeOverlay,
    resumeOnDocumentPage,
    skipTutorial,
    goNext,
    goBack,
    restartTutorial,
    totalSteps: steps.length,
  };
}