import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * SectionDeletionVoteBar
 * Active voting bar for existing / accepted sections.
 * "pro" = keep the section, "con" = delete it.
 * When (con - pro) >= document threshold, the section is deleted (handled in voteOnSection).
 */
export default function SectionDeletionVoteBar({ section, document, user, isRTL, initialVotes = [], canParticipate = true, onCannotParticipate, onSuggestEdit, onSuggestEditThenVote, readOnly = false, sourceSuggestion }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [showConDialog, setShowConDialog] = useState(false);

  const { data: sectionVotes = [] } = useQuery({
    queryKey: ["sectionVotes", section.id],
    queryFn: () => base44.entities.SectionVote.filter({ sectionId: section.id }),
    staleTime: 60 * 1000,
    placeholderData: initialVotes
  });

  // Only direct SectionVote records — no inherited suggestion votes.
  // Inheriting suggestion votes caused double-counting: a user who voted on the
  // suggestion (inherited) and then voted directly on the section was counted twice.
  // The suggestion's own votes are displayed on the suggestion's VotingProgressSection.
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
        toast.success(
          language === 'he' ? 'הצבעתך התקבלה והסעיף הוסר' :
          language === 'ar' ? 'تم تسجيل تصويتك وتمت إزالة القسم' :
          'Your vote was received and the section was removed'
        );
        // Notify SectionCarousel to play the red border flash animation
        window.dispatchEvent(new CustomEvent('section-deleted-flash', { detail: { sectionId: section.id } }));
        // Delay query invalidation so the section stays visible during the flash
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
          queryClient.invalidateQueries({ queryKey: ['documentAggregatedData', document.id] });
        }, 4000);
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
    // "con" on an existing/accepted section: if already voted con, toggle off directly;
    // otherwise show a dialog inviting the user to suggest an improvement (legacy behavior).
    if (voteType === 'con' && userVote?.vote !== 'con') {
      setShowConDialog(true);
      return;
    }
    voteMutation.mutate(voteType);
  };

  const handleConVoteOnly = () => {
    setShowConDialog(false);
    voteMutation.mutate('con');
  };

  const handleConVoteAndSuggest = () => {
    setShowConDialog(false);
    // New flow: open the suggestion modal FIRST. The 'con' vote is registered
    // only after the suggestion is successfully published (handled by the parent
    // via pendingConVoteSectionId). If the modal is cancelled, no vote is cast.
    if (onSuggestEditThenVote) {
      onSuggestEditThenVote(section);
    } else if (onSuggestEdit) {
      onSuggestEdit(section);
    }
  };

  const isHe = language === 'he';
  const isAr = language === 'ar';

  const statusText = passed ?
  isHe ? '✓ הסעיף יימחק' : isAr ? '✓ سيُحذف القسم' : '✓ Section will be deleted' :
  hoverVote === 'con' && userVote?.vote === 'con' ?
  isHe ? 'הצבעת למחוק • לחץ/י שוב לביטול' : isAr ? 'صوتت للحذف • اضغط مجدداً للإلغاء' : 'You voted to delete • click again to cancel' :
  hoverVote === 'pro' && userVote?.vote === 'pro' ?
  isHe ? 'הצבעת בעד • לחץ/י שוב לביטול' : isAr ? 'صوتت مع • اضغط مجدداً للإلغاء' : 'You voted in favor • click again to cancel' :
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
        
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 group-hover:border-red-200 transition-colors" data-tutorial="support-threshold">
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

      </div>

      <Dialog open={showConDialog} onOpenChange={(open) => { if (!open) setShowConDialog(false); }}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              {isHe ? 'האם ברצונך להציע שיפור לנוסח הסעיף?' : isAr ? 'هل تريد اقتراح تحسين لنص القسم؟' : 'Would you like to suggest an improvement?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {isHe ? 'הצבעתך נגד תירשם. תוכל גם להציע שינוי לנוסח הסעיף.' : isAr ? 'سيتم تسجيل تصويتك ضد. يمكنك أيضاً اقتراح تعديل على نص القسم.' : 'Your vote against will be recorded. You can also suggest a change to the section text.'}
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleConVoteOnly} className="flex-1">
              {isHe ? 'הצבע נגד בלבד' : isAr ? 'صوّت ضد فقط' : 'Vote against only'}
            </Button>
            <Button onClick={handleConVoteAndSuggest} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600">
              {isHe ? 'הצע שיפור' : isAr ? 'اقترح تحسيناً' : 'Suggest improvement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}