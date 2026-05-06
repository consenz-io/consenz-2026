import React from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  const { language } = useLanguage();
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

  const threshold = Math.max(2, document?.threshold || 2);
  const proVotes = suggestion.proVotes || 0;
  const conVotes = suggestion.conVotes || 0;
  const delta = proVotes - conVotes;
  const progressPercent = Math.min(100, Math.max(0, (delta / threshold) * 100));
  const statusText = votesNeeded === 1
    ? (language === 'he' ? 'עוד הצבעת בעד אחת חסרה לאישור' : language === 'ar' ? 'مطلوب مؤيد واحد فقط للموافقة' : '1 more supporter needed')
    : (language === 'he' ? `עוד ${votesNeeded} תומכים דרושים לאישור` : language === 'ar' ? `${votesNeeded} مؤيدين إضافيين مطلوبين للموافقة` : `${votesNeeded} more supporters needed`);

  return (
    <Link
      to={`${createPageUrl("UnderstandingConsensus")}?id=${document?.id}&returnUrl=${encodeURIComponent(returnUrl)}`}
      className="block group"
    >
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 group-hover:border-blue-200 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600">
            {language === 'he' ? 'התקדמות לאישור' : language === 'ar' ? 'تقدم نحو القبول' : 'Progress to acceptance'}
          </span>
          <span className="text-xs font-bold text-slate-500">
            {`${Math.max(0, delta)}/${threshold}`}
          </span>
        </div>
        <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-blue-400 transition-colors duration-300"
            initial={false}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>
        <p className="text-xs mt-2 text-center font-medium text-slate-500">
          {statusText}
        </p>
      </div>
    </Link>
  );
});

export default VotesNeededCounter;