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

    // אם threshold = 1, צריך שכל ההצבעות יהיו בעד
    if (threshold >= 1) {
      return conVotes > 0 ? Infinity : (1 - proVotes);
    }

    // חישוב מתמטי נכון: כמה pro votes נדרשות כדי להגיע ל-threshold
    // threshold = proVotes / (proVotes + conVotes)
    // נפתור עבור proVotes החדש:
    // threshold * (proVotes_new + conVotes) = proVotes_new
    // threshold * proVotes_new + threshold * conVotes = proVotes_new
    // threshold * conVotes = proVotes_new - threshold * proVotes_new
    // threshold * conVotes = proVotes_new * (1 - threshold)
    // proVotes_new = (threshold * (proVotes + conVotes)) / (1 - threshold)
    
    const totalNeeded = (threshold * (proVotes + conVotes)) / (1 - threshold);
    const additionalVotesNeeded = Math.ceil(totalNeeded) - proVotes;
    
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

  if (votesNeeded === Infinity) {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-amber-700">
        <Target className="w-3 h-3" />
        {t('fullAgreementNeeded')}
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