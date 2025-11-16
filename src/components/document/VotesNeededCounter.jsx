import React from "react";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function VotesNeededCounter({ suggestion, document, acceptedSuggestions = [], t }) {
  const calculateVotesNeeded = () => {
    const proVotes = suggestion.proVotes || 0;
    const conVotes = suggestion.conVotes || 0;
    
    // חישוב threshold דינמי מההצעות שאושרו
    const docAcceptedSuggestions = acceptedSuggestions.filter(s => s.documentId === document?.id && s.status === 'accepted');
    let threshold;
    
    if (docAcceptedSuggestions.length > 0) {
      // מחשבים את הממוצע של הדלתא (הפרש בין בעד לנגד) מההצעות המאושרות
      const deltas = docAcceptedSuggestions.map(s => {
        return (s.proVotes || 0) - (s.conVotes || 0);
      });
      const avgDelta = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
      threshold = Math.max(1, Math.round(avgDelta));
    } else {
      // אם אין הצעות מאושרות, משתמשים ב-threshold של המסמך
      threshold = document?.threshold || 2;
    }

    // חישוב הדלתא הנוכחית
    const currentDelta = proVotes - conVotes;
    
    // אם כבר עברנו את הסף, לא צריך הצבעות נוספות
    if (currentDelta >= threshold) {
      return 0;
    }

    // כמה הצבעות בעד נוספות נדרשות כדי להגיע לדלתא הנדרשת
    return threshold - currentDelta;
  };

  const votesNeeded = calculateVotesNeeded();

  if (suggestion.status !== 'pending') {
    return null;
  }

  if (votesNeeded === 0) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-300 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        {t('passedConsensusThreshold')}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <Target className="w-3 h-3" />
      {t('votesNeededToPass').replace('{count}', votesNeeded)}
    </Badge>
  );
}