import React from "react";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function VotesNeededCounter({ suggestion, document, sectionId }) {
  const { t } = useLanguage();

  // חישוב כמה הצבעות נדרשות
  const calculateVotesNeeded = () => {
    if (!document || !suggestion) return 1;
    
    const proVotes = suggestion.proVotes || 0;
    const conVotes = suggestion.conVotes || 0;
    const totalUsers = document.totalUsersInteracted || 1;
    
    // חישוב threshold דינמי על בסיס consensuses של המסמך
    let threshold;
    const consensuses = document.consensuses || [];
    
    if (consensuses.length > 0) {
      // מגבילים כל ערך ל-1 מקסימום (כי consensuses אמורים להיות בין 0 ל-1)
      const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
      // מינימום threshold הוא 1 (לא מעגלים למטה - רק למעלה)
      threshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));
    } else {
      threshold = Math.max(1, document.threshold || 2);
    }

    // חישוב הדלתא הנוכחית
    const currentDelta = proVotes - conVotes;
    
    // אם כבר עברנו את הסף, לא צריך הצבעות נוספות
    if (currentDelta >= threshold) {
      return 0;
    }

    // כמה הצבעות בעד נוספות נדרשות
    return threshold - currentDelta;
  };

  const votesNeeded = calculateVotesNeeded();

  if (!suggestion || suggestion.status !== 'pending') {
    return null;
  }

  if (votesNeeded === 0 && suggestion.status === 'accepted') {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-300 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        {t('passedConsensusThreshold')}
      </Badge>
    );
  }

  // Build return URL with scroll position
  const returnParams = new URLSearchParams();
  returnParams.set('id', document?.id);
  if (sectionId) returnParams.set('scrollTo', sectionId);
  if (suggestion?.id) returnParams.set('openSuggestion', suggestion.id);
  const returnUrl = `${createPageUrl("DocumentView")}?${returnParams.toString()}`;

  return (
    <Link to={`${createPageUrl("UnderstandingConsensus")}?id=${document?.id}&returnUrl=${encodeURIComponent(returnUrl)}`}>
      <Badge variant="outline" className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 transition-colors">
        <Target className="w-3 h-3" />
        {t('votesNeededToPass').replace('{count}', votesNeeded)}
      </Badge>
    </Link>
  );
}