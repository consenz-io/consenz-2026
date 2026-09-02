import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { Button } from "@/components/ui/button";

/**
 * Centered "Return to tour" button shown when the user navigates to a different
 * page during an active tutorial. Same centered bottom position as the "Tour the
 * Platform" button for new users. Clicking it navigates back to the page the
 * current step expects (home / document / versions).
 */
export default function TutorialReturnButton({ targetPage, documentId, isRTL }) {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const handleClick = () => {
    if (targetPage === 'home') {
      navigate('/');
    } else if (targetPage === 'document') {
      navigate(documentId ? `/DocumentView?id=${documentId}` : '/DocumentView');
    } else if (targetPage === 'versions') {
      navigate(documentId ? `/DocumentCleanView?id=${documentId}` : '/DocumentCleanView');
    }
  };

  const label = language === 'he'
    ? 'חזרה לסיור'
    : language === 'ar'
    ? 'العودة إلى الجولة'
    : 'Return to tour';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-6 inset-x-0 z-[10000] flex justify-center px-4 pointer-events-none"
    >
      <Button
        size="lg"
        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg pointer-events-auto"
        onClick={handleClick}
      >
        {label}
        {isRTL ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
      </Button>
    </motion.div>
  );
}