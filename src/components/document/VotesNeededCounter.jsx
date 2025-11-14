import React from "react";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";

export default function VotesNeededCounter({ suggestion, document }) {
  const calculateVotesNeeded = () => {
    const proVotes = suggestion.proVotes || 0;
    const conVotes = suggestion.conVotes || 0;
    const threshold = document.threshold || 0.5;
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

    // אם threshold = 1, אי אפשר להגיע (צריך 100% ללא הצבעות נגד)
    if (threshold >= 1) {
      return conVotes > 0 ? Infinity : 1;
    }

    // חישוב כמה הצבעות בעד נדרשות
    const votesNeeded = (threshold * totalVotes - proVotes) / (1 - threshold);
    return Math.ceil(Math.max(0, votesNeeded));
  };

  const votesNeeded = calculateVotesNeeded();

  if (suggestion.status !== 'pending') {
    return null;
  }

  if (votesNeeded === 0) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-300 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        עבר את סף הקונסנזוס!
      </Badge>
    );
  }

  if (votesNeeded === Infinity) {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-amber-700">
        <Target className="w-3 h-3" />
        דרושה הסכמה מלאה
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <Target className="w-3 h-3" />
      חסרים {votesNeeded} תומכים לאישור
    </Badge>
  );
}