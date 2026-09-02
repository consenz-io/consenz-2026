import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Floating "Return to tour" button shown when the user navigates to a different
 * page during an active tutorial. Clicking it navigates back to the page the
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
    <button
      onClick={handleClick}
      className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} z-[10000] flex items-center gap-2 px-5 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xl transition-all hover:scale-105 tutorial-card-flash`}
      aria-label={label}
    >
      {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
      {label}
    </button>
  );
}