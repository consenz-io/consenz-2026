import React from "react";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { calculateContributorsFromData } from "./calculateContributors";

const VotesNeededCounter = React.memo(function VotesNeededCounter({ suggestion, document, sectionId }) {
  const { t } = useLanguage();

  // Fetch all data needed for dynamic contributor calculation
  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', document?.id],
    queryFn: () => base44.entities.Suggestion.filter({ documentId: document.id }),
    enabled: !!document?.id,
    initialData: [],
  });

  const { data: allVotes = [] } = useQuery({
    queryKey: ['allVotes'],
    queryFn: () => base44.entities.Vote.list(),
    initialData: [],
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: allArguments = [] } = useQuery({
    queryKey: ['allArguments'],
    queryFn: () => base44.entities.Argument.list(),
    initialData: [],
  });

  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments'],
    queryFn: () => base44.entities.Comment.list(),
    initialData: [],
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections', document?.id],
    queryFn: () => base44.entities.Section.filter({ documentId: document.id }),
    enabled: !!document?.id,
    initialData: [],
  });

  // חישוב דינמי של מספר המשתתפים - בדיוק כמו ב-UnderstandingConsensus
  const totalUsers = React.useMemo(() => {
    if (!document) return 1;
    const count = calculateContributorsFromData({
      document,
      suggestions,
      allVotes,
      allUsers,
      allArguments,
      allComments,
      sections
    });
    return count > 0 ? count : 1;
  }, [document, suggestions, allVotes, allUsers, allArguments, allComments, sections]);

  // חישוב כמה הצבעות נדרשות
  const calculateVotesNeeded = () => {
    if (!document || !suggestion) return 1;
    
    const proVotes = suggestion.proVotes || 0;
    const conVotes = suggestion.conVotes || 0;
    
    // שימוש ב-threshold הקבוע של המסמך (לא חישוב דינמי!)
    // ה-threshold מתעדכן רק כשהצעה מתקבלת
    const threshold = Math.max(2, document.threshold || 2);

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

  // If auto-accept is disabled, don't show the threshold counter
  if (document?.autoAcceptEnabled === false) {
    return null;
  }

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
      <Badge variant="outline" className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 transition-colors w-full justify-center">
        <Target className="w-3 h-3" />
        {t('votesNeededToPass').replace('{count}', votesNeeded)}
      </Badge>
    </Link>
  );
});

export default VotesNeededCounter;