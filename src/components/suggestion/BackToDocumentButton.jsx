import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Compact "Back to document" navigation anchor for the suggestion detail page.
 * Kept intentionally small: the page title already shows the document name,
 * so this is a secondary navigation affordance, not the primary action.
 */
export default function BackToDocumentButton({ suggestion, suggestionId, isRTL }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleClick = () => {
    const anchor =
      suggestion.type === 'edit_section' || suggestion.type === 'edit_suggestion'
        ? `section-${suggestion.sectionId}`
        : `suggestion-${suggestionId}`;
    navigate(`${createPageUrl("DocumentView")}?id=${suggestion.documentId}#${anchor}`);
    setTimeout(() => {
      window.document?.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="h-9 px-3.5 text-sm font-semibold text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300 gap-1.5 shadow-sm"
    >
      {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
      {t('backToDocument')}
    </Button>
  );
}