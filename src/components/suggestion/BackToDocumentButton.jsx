import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageContext";

/**
 * "Back to document" button for the suggestion detail page.
 * Navigates to the document and always lands on the relevant place:
 * - Pending suggestion → scrolls to the proposal card itself (targetSuggestion),
 *   and the SectionCarousel navigates to it. Works for proposals whose section
 *   was deleted too — their card is shown at the section's original position.
 * - Closed suggestion whose section still exists → scrolls to that section.
 * - Closed suggestion whose section was deleted → scrolls to the topic the
 *   section belonged to, so the reader still lands in the right place.
 */
export default function BackToDocumentButton({ suggestion, suggestionId, isRTL, sectionExists, topicId }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleClick = () => {
    const docId = suggestion.documentId;
    let url = `${createPageUrl("DocumentView")}?id=${docId}`;

    if (suggestion.status === 'pending') {
      url += `&targetSuggestion=${suggestionId}`;
    } else if (suggestion.sectionId && sectionExists) {
      url += `&scrollTo=section-${suggestion.sectionId}`;
    } else if (topicId) {
      url += `&scrollTo=topic-${topicId}`;
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