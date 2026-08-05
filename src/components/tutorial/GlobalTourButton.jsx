import React from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { Button } from "@/components/ui/button";

const FIRST_VISIT_KEY = "consenz_first_visit_done";
const TUTORIAL_STORAGE_KEY = "consenz_tutorial";

const tourLabel = { he: "לסיור בפלטפורמה", ar: "جولة في المنصة", en: "Tour the Platform" };

/**
 * A floating "Tour the Platform" button pinned to the bottom of the screen.
 * Shown on every page for first-time visitors OR unauthenticated users.
 * On the Home page it is hidden, since HeroSection already renders its own
 * (scroll-morphing) tour button there.
 */
export default function GlobalTourButton({ user }) {
  const { isRTL, language } = useLanguage();
  const location = useLocation();

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

  // Only show for first-time visitors or logged-out users, and never on Home
  if (isHomePage || (!isFirstVisit && !isLoggedOut)) return null;

  const startTutorial = () => {
    try {
      localStorage.setItem(FIRST_VISIT_KEY, "true");
      const fresh = { active: true, homeStepSeen: false, currentStep: 0, completedSteps: [] };
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(fresh));
    } catch {}
    setIsFirstVisit(false);
    if (window.restartTutorial) {
      window.restartTutorial("home");
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