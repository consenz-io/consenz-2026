import React from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const FIRST_VISIT_KEY = "consenz_first_visit_done";
const TUTORIAL_STORAGE_KEY = "consenz_tutorial";

const tourLabel = { he: "לסיור בפלטפורמה", ar: "جولة في المنصة", en: "Tour the Platform" };
const loginLabel = { he: "התחברות", ar: "تسجيل الدخول", en: "Sign in" };

// Read the persisted tutorial state and decide whether the tour was fully completed.
// A completed tour is stored as { active: false, currentStep > 0 }.
function readTutorialCompleted() {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    return s.active === false && (s.currentStep ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * A floating "Tour the Platform" button pinned to the bottom of the screen.
 * Shown on every page for first-time visitors OR unauthenticated users.
 * On the Home page it is hidden, since HeroSection already renders its own
 * (scroll-morphing) tour button there.
 */
export default function GlobalTourButton({ user }) {
  const { isRTL, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // First-visit detection — persisted in localStorage
  const [isFirstVisit, setIsFirstVisit] = React.useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(FIRST_VISIT_KEY) !== "true";
    } catch {
      return false;
    }
  });

  const isLoggedOut = !user;
  const isHomePage = location.pathname === "/" || /\/Home/i.test(location.pathname);

  // Track whether the tour has been fully completed (persisted in localStorage).
  // Poll on an interval so the button swaps to "Sign in" as soon as the tour ends.
  const [tourCompleted, setTourCompleted] = React.useState(readTutorialCompleted);
  React.useEffect(() => {
    const check = () => setTourCompleted(readTutorialCompleted());
    check();
    const id = setInterval(check, 1000);
    window.addEventListener("storage", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("storage", check);
    };
  }, []);

  // Only show for first-time visitors or logged-out users, and never on Home
  if (isHomePage || (!isFirstVisit && !isLoggedOut)) return null;

  // Logged-out user who finished the whole tour → show a floating "Sign in" button
  // (same floating style as the tour button, in a slightly different color).
  if (isLoggedOut && tourCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
      >
        <Button
          size="lg"
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg pointer-events-auto"
          onClick={() => base44.auth.redirectToLogin(window.location.href)}
        >
          {isRTL ? (
            <>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {loginLabel[language] || loginLabel.en}
            </>
          ) : (
            <>
              {loginLabel[language] || loginLabel.en}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </motion.div>
    );
  }

  const startTutorial = () => {
    try {
      localStorage.setItem(FIRST_VISIT_KEY, "true");
      const fresh = { active: true, homeStepSeen: false, currentStep: 0, completedSteps: [] };
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(fresh));
    } catch {}
    setIsFirstVisit(false);
    // Choose the entry point based on the current page so the tour starts correctly.
    // On a document page it must start directly there; passing "home" would route the
    // flow through home-intro and leave nothing visible on the document page.
    const path = location.pathname;
    const isCleanView = /\/DocumentCleanView/i.test(path);
    const isDocPage = /\/(DocumentView|document)/i.test(path) && !isCleanView;
    const isGroupPage = /\/(GroupView|group)/i.test(path);

    // On the versions page — navigate back to the relevant document page and
    // start the tour from the first bubble there.
    if (isCleanView) {
      const documentId = new URLSearchParams(location.search).get("id");
      if (documentId) {
        navigate(`/DocumentView?id=${documentId}`);
      }
      if (window.restartTutorial) {
        window.restartTutorial("document", 0);
      }
      return;
    }

    const entryPoint = isDocPage ? "document" : isGroupPage ? "group" : "home";
    if (window.restartTutorial) {
      window.restartTutorial(entryPoint);
    } else {
      window.location.reload();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
    >
      <Button
        size="lg"
        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg pointer-events-auto"
        onClick={startTutorial}
      >
        {tourLabel[language] || tourLabel.en}
        {isRTL ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
      </Button>
    </motion.div>
  );
}