import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageContext";

/**
 * SectionDeletionVoteBar
 * Active voting bar for existing / accepted sections.
 * "pro" = keep the section, "con" = delete it.
 * When (con - pro) >= document threshold, the section is deleted (handled in voteOnSection).
 */
export default function SectionDeletionVoteBar({ section, document, user, isRTL, initialVotes = [], canParticipate = true, onCannotParticipate, readOnly = false }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  const { data: sectionVotes = [] } = useQuery({
    queryKey: ["sectionVotes", section.id],
    queryFn: () => base44.entities.SectionVote.filter({ sectionId: section.id }),
    staleTime: 60 * 1000,
    placeholderData: initialVotes
  });

  const proCount = sectionVotes.filter((v) => v.vote === "pro").length;
  const conCount = sectionVotes.filter((v) => v.vote === "con").length;
  const userVote = user?.id ? sectionVotes.find((v) => v.userId === user.id) : null;

  const threshold = Math.max(2, document?.threshold || 2);
  // delta = opponents (con) minus supporters (pro) — drives the deletion progress
  const delta = conCount - proCount;
  const votesNeeded = Math.max(0, threshold - delta);
  const passed = delta >= threshold;
  const progressPercent = Math.min(100, Math.max(0, delta / threshold * 100));

  const [hoverVote, setHoverVote] = useState(null);

  // Simulate the effect of a pro/con vote on the deletion progress
  const afterProDelta = delta - (userVote?.vote === 'con' ? 2 : 1);
  const afterConDelta = delta + (userVote?.vote === 'pro' ? 2 : 1);
  const afterProProgress = Math.min(100, Math.max(0, afterProDelta / threshold * 100));
  const afterConProgress = Math.min(100, Math.max(0, afterConDelta / threshold * 100));

  const displayProgress = hoverVote === 'pro' ?
  afterProProgress :
  hoverVote === 'con' ?
  afterConProgress :
  progressPercent;

  const barColor = passed ?
  'bg-red-500' :
  hoverVote === 'pro' ?
  'bg-blue-400' :
  hoverVote === 'con' ?
  'bg-red-500' :
  'bg-red-400';

  const voteMutation = useMutation({
    mutationFn: async (voteType) => {
      if (!user?.id) return;
      const res = await base44.functions.invoke('voteOnSection', { sectionId: section.id, vote: voteType });
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.votes) {
        queryClient.setQueryData(["sectionVotes", section.id], data.votes);
      } else {
        queryClient.invalidateQueries({ queryKey: ["sectionVotes", section.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["allSectionVotes"] });
      if (data?.sectionDeleted) {
        queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
        queryClient.invalidateQueries({ queryKey: ['documentAggregatedData', document.id] });
      }
    }
  });

  const handleVote = (voteType) => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    if (!canParticipate) {
      if (onCannotParticipate) onCannotParticipate();
      return;
    }
    voteMutation.mutate(voteType);
  };

  const isHe = language === 'he';
  const isAr = language === 'ar';

  const statusText = passed ?
  isHe ? '✓ הסעיף יימחק' : isAr ? '✓ سيُحذف القسم' : '✓ Section will be deleted' :
  hoverVote === 'con' ?
  isHe ? 'הצבעתך תקרב את מחיקת הסעיף' : isAr ? 'سيقرب صوتك حذف القسم' : 'Your vote will help delete this section' :
  hoverVote === 'pro' ?
  isHe ? 'הצבעתך תרחיק את מחיקת הסעיף' : isAr ? 'سيبعد صوتك حذف القسم' : 'Your vote will keep this section' :
  votesNeeded === 1 ?
  isHe ? 'אם עוד אחד יצביע נגד, הסעיף יבוטל' : isAr ? 'إذا صوت واحد آخر ضد، سيُلغى القسم' : 'If 1 more votes against, the section will be cancelled' :
  isHe ? `אם עוד ${votesNeeded} יצביעו נגד, הסעיף יבוטל` : isAr ? `إذا صوت ${votesNeeded} آخرون ضد، سيُلغى القسم` : `If ${votesNeeded} more vote against, the section will be cancelled`;

  return (
    <div className="space-y-3">
      <Link
        to={`${createPageUrl("UnderstandingConsensus")}?id=${document?.id}`}
        className="block group"
        title={isHe ? 'למדו על מנגנון הקונצנזוס' : 'Learn about consensus'}>
        
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 group-hover:border-red-200 transition-colors">
          {/* Labels row */}
          <div className="flex items-center justify-between mb-2">
            

            
            

            
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              key={`${section.id}-delete-bar`}
              className={`h-full rounded-full ${barColor} transition-colors duration-300`}
              initial={{ width: `${displayProgress}%` }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
            
          </div>

          {/* Status text */}
          {!passed &&
          <p className="text-xs text-slate-600 mt-1.5 font-medium text-center" dir={isRTL ? 'rtl' : 'ltr'}>
              {statusText}
            </p>
          }
        </div>
      </Link>

      {/* Vote buttons */}
      <div className="relative">
        {voteMutation.isPending &&
        <div className="absolute inset-0 bg-white/60 rounded-xl flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-red-600" />
          </div>
        }
        <div className="flex gap-2 w-full min-w-0">
          <Button
            variant={userVote?.vote === 'pro' ? 'default' : 'outline'}
            onClick={() => handleVote('pro')}
            disabled={voteMutation.isPending || readOnly}
            onMouseEnter={() => setHoverVote('pro')}
            onMouseLeave={() => setHoverVote(null)}
            className={`flex-1 min-w-0 h-10 md:h-12 text-sm md:text-base font-semibold rounded-xl transition-all duration-200 px-2 md:px-4 ${
            userVote?.vote === 'pro' ?
            'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200' :
            'border-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400'}`
            }>
            
            <ThumbsUp className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="truncate">{isHe ? 'בעד' : isAr ? 'مع' : 'Pro'}</span>
            {proCount > 0 && <span className="text-xs md:text-sm opacity-80 shrink-0">({proCount})</span>}
          </Button>
          <Button
            variant={userVote?.vote === 'con' ? 'default' : 'outline'}
            onClick={() => handleVote('con')}
            disabled={voteMutation.isPending || readOnly}
            onMouseEnter={() => setHoverVote('con')}
            onMouseLeave={() => setHoverVote(null)}
            className={`flex-1 min-w-0 h-10 md:h-12 text-sm md:text-base font-semibold rounded-xl transition-all duration-200 px-2 md:px-4 ${
            userVote?.vote === 'con' ?
            'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200' :
            'border-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-400'}`
            }>
            
            <ThumbsDown className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="truncate">{isHe ? 'נגד' : isAr ? 'ضد' : 'Con'}</span>
            {conCount > 0 && <span className="text-xs md:text-sm opacity-80 shrink-0">({conCount})</span>}
          </Button>
        </div>
        {userVote &&
        <p className="text-center text-xs text-slate-400 mt-1.5">
            {userVote.vote === 'pro' ?
          isHe ? 'הצבעת להשאיר • לחץ/י שוב לביטול' : isAr ? 'صوتك للإبقاء • اضغط مجدداً للإلغاء' : 'You voted to keep • click again to remove' :
          isHe ? 'הצבעת למחוק • לחץ/י שוב לביטול' : isAr ? 'صوتك للحذف • اضغط مجدداً للإلغاء' : 'You voted to delete • click again to remove'}
          </p>
        }
      </div>
    </div>);

}