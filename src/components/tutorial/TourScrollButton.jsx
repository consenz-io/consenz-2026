import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";

/**
 * "Tour the Platform" CTA that starts inline in the hero and, once it scrolls
 * out of view, morphs into a fixed button pinned to the bottom of the screen.
 * Shared by the Home hero and the Learn More hero so both behave the same.
 */
export default function TourScrollButton({ label, onClick }) {
  const { isRTL } = useLanguage();
  const buttonRef = React.useRef(null);
  const [showFloating, setShowFloating] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      const el = buttonRef.current;
      if (!el) return;
      setShowFloating(el.getBoundingClientRect().bottom < 0);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const arrow = isRTL ?
  <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" /> :
  <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />;

  return (
    <>
      <div ref={buttonRef} className="w-full md:w-auto">
        {!showFloating &&
        <motion.div
          layoutId="tour-button"
          className="inline-flex w-full md:w-auto"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}>
          
            <Button
            size="lg"
            className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            onClick={onClick}>
            
              {label}
              {arrow}
            </Button>
          </motion.div>
        }
      </div>

      {showFloating &&
      <motion.div
        layoutId="tour-button"
        className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}>
        
          <Button
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg pointer-events-auto"
          onClick={onClick}>
          
            {label}
            {arrow}
          </Button>
        </motion.div>
      }
    </>);

}