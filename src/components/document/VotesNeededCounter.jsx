import React, { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { checkSuggestionConsensus, autoAcceptSuggestion } from "./suggestionAutoAccept";

export default function VotesNeededCounter({ suggestion, document, acceptedSuggestions = [] }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const hasTriggeredAutoAccept = useRef(new Set());

  // שימוש באותה לוגיקת threshold כמו ב-checkSuggestionConsensus
  const calculateVotesNeeded = () => {
    if (!document) return 1;
    
    const proVotes = suggestion.proVotes || 0;
    const conVotes = suggestion.conVotes || 0;
    const totalUsers = document.totalUsersInteracted || 1;
    
    // חישוב threshold דינמי על בסיס consensuses של המסמך - זהה ל-checkSuggestionConsensus
    let threshold;
    const consensuses = document.consensuses || [];
    
    if (consensuses.length > 0) {
      const consensusMeterAverage = consensuses.reduce((sum, val) => sum + val, 0) / consensuses.length;
      threshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));
    } else {
      threshold = document.threshold || 2;
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

  // Auto-accept logic when threshold is met
  useEffect(() => {
    const triggerAutoAccept = async () => {
      if (suggestion.status !== 'pending' || !document) return;
      
      const checkKey = `${suggestion.id}-${suggestion.proVotes}-${suggestion.conVotes}`;
      if (hasTriggeredAutoAccept.current.has(checkKey)) return;
      
      const { shouldAccept } = await checkSuggestionConsensus(suggestion, document);
      
      if (shouldAccept) {
        hasTriggeredAutoAccept.current.add(checkKey);
        console.log('[VotesNeededCounter] Auto-accepting suggestion:', suggestion.id);
        
        const accepted = await autoAcceptSuggestion(suggestion, suggestion.created_by, document);
        
        if (accepted) {
          console.log('[VotesNeededCounter] Suggestion accepted, refreshing queries');
          queryClient.invalidateQueries({ queryKey: ['suggestions'] });
          queryClient.invalidateQueries({ queryKey: ['sections'] });
          queryClient.invalidateQueries({ queryKey: ['document'] });
          queryClient.invalidateQueries({ queryKey: ['allVersions'] });
          queryClient.invalidateQueries({ queryKey: ['versions'] });
          queryClient.invalidateQueries({ queryKey: ['suggestion', suggestion.id] });
        }
      }
    };
    
    if (votesNeeded === 0 && suggestion.status === 'pending') {
      triggerAutoAccept();
    }
  }, [suggestion.id, suggestion.status, suggestion.proVotes, suggestion.conVotes, document?.id, votesNeeded, queryClient]);

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