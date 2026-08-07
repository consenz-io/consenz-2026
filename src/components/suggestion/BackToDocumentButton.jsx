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
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
    >
      {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
      {t('backToDocument')}
    </Button>
  );
}