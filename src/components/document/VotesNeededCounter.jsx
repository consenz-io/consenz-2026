import React from "react";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function VotesNeededCounter({ suggestion, document, acceptedSuggestions = [] }) {
  const { t } = useLanguage();
  const calculateVotesNeeded = () => {
    const proVotes = suggestion.proVotes || 0;
    const conVotes = suggestion.conVotes || 0;
    
    // חישוב threshold דינמי מההצעות שאושרו
    const docAcceptedSuggestions = acceptedSuggestions.filter(s => s.documentId === document?.id && s.status === 'accepted');
    let threshold = 0.5;
    if (docAcceptedSuggestions.length > 0) {
      const avg = docAcceptedSuggestions.reduce((sum, s) => {
        const total = (s.proVotes || 0) + (s.conVotes || 0);
        return sum + (total > 0 ? (s.proVotes / total) : 0);
      }, 0) / docAcceptedSuggestions.length;
      threshold = avg;
    }
    
    const totalVotes = proVotes + conVotes;

    if (totalVotes === 0) {
      // אם אין הצבעות בכלל, צריך לפחות הצבעה אחת
      return 1;
    }

    const currentConsensus = proVotes / totalVotes;

    // אם כבר עברנו את הסף
    if (currentConsensus >= threshold) {
      return 0;
    }

    // חישוב מתמטי נכון: כמה pro votes נדרשות כדי להגיע ל-threshold
    // threshold = (proVotes + x) / (proVotes + x + conVotes)
    // נפתור עבור x (מספר ההצבעות הנוספות הנדרשות):
    // threshold * (proVotes + x + conVotes) = proVotes + x
    // threshold * proVotes + threshold * x + threshold * conVotes = proVotes + x
    // threshold * x - x = proVotes - threshold * proVotes - threshold * conVotes
    // x * (threshold - 1) = proVotes - threshold * (proVotes + conVotes)
    // x = (threshold * (proVotes + conVotes) - proVotes) / (1 - threshold)
    
    const votesNeeded = (threshold * (proVotes + conVotes) - proVotes) / (1 - threshold);
    const additionalVotesNeeded = Math.ceil(votesNeeded);
    
    return Math.max(1, additionalVotesNeeded);
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