import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

const TUTORIAL_STORAGE_KEY = "consenz_tutorial";

/**
 * Shared actions for the Learn More page CTAs: starting the platform tour
 * from its first step, and sending a logged-out visitor to sign in.
 */
export default function usePlatformCtas() {
  const { user } = useAuth();

  const startTour = () => {
    try {
      localStorage.setItem(
        TUTORIAL_STORAGE_KEY,
        JSON.stringify({ active: true, homeStepSeen: false, currentStep: 0, completedSteps: [] })
      );
    } catch {}
    if (window.restartTutorial) {
      window.restartTutorial("home");
    } else {
      window.location.reload();
    }
  };

  const signIn = () => base44.auth.redirectToLogin(window.location.href);

  return { user, startTour, signIn };
}