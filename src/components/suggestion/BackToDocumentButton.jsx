import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageContext";

/**
 * "Back to document" button for the suggestion detail page.
 * Navigates to the document and scrolls to the relevant position:
 * - Pending suggestion → scrolls to the suggestion card (via targetSuggestion param,
 *   which also auto-navigates the SectionCarousel to it and force-mounts its section)
 * - Accepted suggestion with sectionId → scrolls to the section (via scrollTo param,
 *   which force-mounts the section and scrolls with retries)
 * - Rejected / accepted-without-section (e.g. delete_section) → just opens the document
 */
export default function BackToDocumentButton({ suggestion, suggestionId, isRTL }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleClick = () => {
    const docId = suggestion.documentId;
    let url = `${createPageUrl("DocumentView")}?id=${docId}`;

    if (suggestion.status === 'pending') {
      url += `&targetSuggestion=${suggestionId}`;
    } else if (suggestion.status === 'accepted' && suggestion.sectionId) {
      url += `&scrollTo=section-${suggestion.sectionId}`;
    }

    navigate(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="w-full h-9 px-3.5 text-sm font-semibold text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300 gap-1.5 shadow-sm"
    >
      {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
      {t('backToDocument')}
    </Button>
  );
}