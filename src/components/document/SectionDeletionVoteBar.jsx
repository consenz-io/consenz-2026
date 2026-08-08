import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, Loader2, AlertTriangle, Pencil, Plus, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageContext";
import CounterTooltip from "./CounterTooltip";
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
export default function SectionDeletionVoteBar({ section, document, user, isRTL, initialVotes = [], canParticipate = true, onCannotParticipate, onSuggestEdit, onSuggestEditThenVote, onConCommentPosted, readOnly = false, sourceSuggestion }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showConDialog, setShowConDialog] = useState(false);
  const [conComment, setConComment] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [suggestTransition, setSuggestTransition] = useState(false);
  const [suggestTransitionHadComment, setSuggestTransitionHadComment] = useState(false);
  const explanationRef = useRef(null);

  // Refs to pass data from the con-vote handlers to voteMutation.onSuccess.
  // pendingCommentRef: the comment ID posted with the con vote (if any).
  // pendingSuggestEditRef: whether the user chose "Vote against & suggest improvement".
  const pendingCommentRef = useRef(null);
  const pendingSuggestEditRef = useRef(false);

  const { data: sectionVotes = [] } = useQuery({
    queryKey: ["sectionVotes", section.id],
    queryFn: () => base44.entities.SectionVote.filter({ sectionId: section.id }),
    staleTime: 60 * 1000,
    placeholderData: initialVotes
  });

  // Deduplicated vote count: each user is counted exactly once.
  // Users who voted on the suggestion that created this section have their vote inherited
  // as a baseline. If that same user then votes directly on the section, their direct vote
  // overrides the inherited one (not added to it). This prevents double-counting — e.g.,
  // 2 participants cannot produce 3 displayed votes.
  const dedupedVotes = React.useMemo(() => {
    const voteMap = new Map();
    // Start with inherited votes from the source suggestion (frozen at acceptance time)
    if (sourceSuggestion?.voters) {
      for (const v of sourceSuggestion.voters) {
        if (v.userId) voteMap.set(v.userId, v.vote);
      }
    }
    // Override with direct SectionVotes — user's most recent stance takes priority
    for (const v of sectionVotes) {
      if (v.userId) voteMap.set(v.userId, v.vote);
    }
    return voteMap;
  }, [sourceSuggestion, sectionVotes]);

  const proCount = Array.from(dedupedVotes.values()).filter((v) => v === "pro").length;
  const conCount = Array.from(dedupedVotes.values()).filter((v) => v === "con").length;
  const userVote = user?.id ? sectionVotes.find((v) => v.userId === user.id) : null;

  const threshold = Math.max(2, document?.threshold || 2);
  // delta = opponents (con) minus supporters (pro) — drives the deletion progress
  const delta = conCount - proCount;
  const votesNeeded = Math.max(0, threshold - delta);
  const passed = delta >= threshold;
  const progressPercent = Math.min(100, Math.max(0, delta / threshold * 100));

  const [hoverVote, setHoverVote] = useState(null);

  // User's effective vote in the dedup map: direct SectionVote overrides inherited suggestion vote.
  // Needed for accurate hover-simulation of the progress bar.
  const userInheritedVote = sourceSuggestion?.voters?.find((v) => v.userId === user?.id)?.vote || null;
  const userEffectiveVote = userVote?.vote || userInheritedVote;

  // Simulate the effect of a pro/con vote on the deletion progress.
  // Clicking the same as your direct vote toggles it off (reverts to inherited or removed).
  // The delta change depends on the user's effective vote (not just their direct vote),
  // because inherited suggestion votes are part of the dedup count.
  const afterProDelta = userVote?.vote === 'pro'
    ? delta + (userInheritedVote === 'pro' ? 0 : userInheritedVote === 'con' ? 2 : 1)  // toggle off direct 'pro'
    : delta - (userEffectiveVote === 'con' ? 2 : userEffectiveVote === 'pro' ? 0 : 1); // switch/create 'pro'
  const afterConDelta = userVote?.vote === 'con'
    ? delta - (userInheritedVote === 'con' ? 0 : userInheritedVote === 'pro' ? 2 : 1)  // toggle off direct 'con'
    : delta + (userEffectiveVote === 'pro' ? 2 : userEffectiveVote === 'con' ? 0 : 1); // switch/create 'con'
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

      const commentId = pendingCommentRef.current;
      const wantSuggestEdit = pendingSuggestEditRef.current;

      if (data?.sectionDeleted) {
        toast.success(
          language === 'he' ? 'הצבעתך התקבלה והסעיף הוסר' :
          language === 'ar' ? 'تم تسجيل تصويتك وتمت إزالة القسم' :
          'Your vote was received and the section was removed'
        );
        // Notify SectionCarousel to play the red border flash animation
        window.dispatchEvent(new CustomEvent('section-deleted-flash', { detail: { sectionId: section.id } }));

        const delSuggId = data?.deleteSuggestionId;
        if (delSuggId) {
          // Comments were repointed to the suggestion on the backend — invalidate
          // so the suggestion detail page fetches fresh data.
          queryClient.invalidateQueries({ queryKey: ['comments', 'suggestion', delSuggId] });
          // Redirect to the delete suggestion detail page so the user sees the
          // voting result and their comment (with scroll). Short delay for the toast.
          setTimeout(() => {
            const url = `${createPageUrl("suggestiondetail")}?id=${delSuggId}${commentId ? `&commentId=${commentId}` : ''}`;
            navigate(url);
          }, 1000);
        } else {
          // Fallback: no suggestion was created — stay on page, invalidate after flash
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
            queryClient.invalidateQueries({ queryKey: ['documentAggregatedData', document.id] });
          }, 4000);
        }
      } else {
        // Section NOT deleted — provide local in-document feedback
        if (commentId && onConCommentPosted) {
          onConCommentPosted(commentId);
        }
        if (wantSuggestEdit && onSuggestEdit) {
          onSuggestEdit(section);
        }
      }

      pendingCommentRef.current = null;
      pendingSuggestEditRef.current = false;
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
    // "con" on an existing/accepted section: if already effectively voted con
    // (direct SectionVote OR inherited suggestion vote), toggle/confirm directly;
    // otherwise show a dialog inviting the user to suggest an improvement.
    if (voteType === 'con' && userEffectiveVote !== 'con') {
      setConComment("");
      setShowExplanation(false);
      setSuggestTransition(false);
      setShowConDialog(true);
      return;
    }
    voteMutation.mutate(voteType);
  };

  const postConComment = async () => {
    const text = conComment.trim();
    if (!text) return null;
    try {
      const comment = await base44.entities.Comment.create({
        rootEntityType: "section",
        rootEntityId: section.id,
        content: text,
      });
      queryClient.invalidateQueries({ queryKey: ["sectionComments", section.id] });
      queryClient.invalidateQueries({ queryKey: ["allComments"] });
      queryClient.invalidateQueries({ queryKey: ['comments', 'section', section.id] });
      return comment;
    } catch (err) {
      console.error("Failed to post con comment:", err);
      return null;
    }
  };

  const handleConVoteOnly = async () => {
    setShowConDialog(false);
    const comment = await postConComment();
    setConComment("");
    pendingCommentRef.current = comment?.id || null;
    pendingSuggestEditRef.current = false;
    voteMutation.mutate('con');
  };

  const handleConVoteAndSuggest = async () => {
    // Intermediate step: show confirmation that the objection was recorded,
    // then transition to the edit-suggestion screen.
    setSuggestTransitionHadComment(!!conComment.trim());
    setSuggestTransition(true);
    const comment = await postConComment();
    setConComment("");
    pendingCommentRef.current = comment?.id || null;
    pendingSuggestEditRef.current = true;
    voteMutation.mutate('con');
    setTimeout(() => {
      setSuggestTransition(false);
      setShowConDialog(false);
    }, 1800);
  };

  const isHe = language === 'he';
  const isAr = language === 'ar';

  const statusText = passed ?
  isHe ? '✓ הסעיף יימחק' : isAr ? '✓ سيُحذف القسم' : '✓ Section will be deleted' :
  hoverVote === 'con' && userEffectiveVote === 'con' ?
  isHe ? `הצבעת נגד${userVote?.vote === 'con' ? ' • לחץ/י שוב לביטול' : ''}` : isAr ? `صوتت ضد${userVote?.vote === 'con' ? ' • اضغط مجدداً للإلغاء' : ''}` : `You voted against${userVote?.vote === 'con' ? ' • click again to cancel' : ''}` :
  hoverVote === 'pro' && userEffectiveVote === 'pro' ?
  isHe ? `הצבעת בעד${userVote?.vote === 'pro' ? ' • לחץ/י שוב לביטול' : ''}` : isAr ? `صوتت مع${userVote?.vote === 'pro' ? ' • اضغط مجدداً للإلغاء' : ''}` : `You voted in favor${userVote?.vote === 'pro' ? ' • click again to cancel' : ''}` :
  hoverVote === 'con' ?
  isHe ? 'הצבעתך תקרב את מחיקת הסעיף' : isAr ? 'سيقرب صوتك حذف القسم' : 'Your vote will help delete this section' :
  hoverVote === 'pro' ?
  isHe ? 'הצבעתך תרחיק את מחיקת הסעיף' : isAr ? 'سيبعد صوتك حذف القسم' : 'Your vote will keep this section' :
  votesNeeded === 1 ?
  isHe ? 'אם עוד אחד יצביע נגד, הסעיף יבוטל' : isAr ? 'إذا صوت واحد آخر ضد، سيُلغى القسم' : 'If 1 more votes against, the section will be cancelled' :
  isHe ? `אם עוד ${votesNeeded} יצביעו נגד, הסעיף יבוטל` : isAr ? `إذا صوت ${votesNeeded} آخرون ضد، سيُلغى القسم` : `If ${votesNeeded} more vote against, the section will be cancelled`;

  return (
    <div className="space-y-3">
      <CounterTooltip
        text={isHe
          ? `${proCount} הצבעות בעד ו-${conCount} הצבעות נגד, ורף התמיכה הדרוש הוא ${threshold} • לחצו למידע נוסף על חישוב מד הקונסנזוס`
          : isAr
          ? `${proCount} أصوات مع و-${conCount} أصوات ضد، وعتبة الدعم المطلوبة هي ${threshold} • انقروا لمزيد من المعلومات حول حساب مقياس الإجماع`
          : `${proCount} pro votes and ${conCount} con votes, support threshold is ${threshold} • Click for more info on consensus meter calculation`}>
        <Link
          to={`${createPageUrl("UnderstandingConsensus")}?id=${document?.id}`}
          className="block group">

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 group-hover:border-red-200 transition-colors" data-tutorial="support-threshold">
            {/* Labels row */}
            <div className="flex items-center justify-between mb-2">






            </div>

            {/* Progress bar */}
            <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                key={`${section.id}-delete-bar`}
                className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} rounded-full ${barColor} transition-colors duration-300`}
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
      </CounterTooltip>

      {/* Vote buttons */}
      <div className="relative">
        {voteMutation.isPending &&
        <div className="absolute inset-0 bg-white/60 rounded-xl flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-red-600" />
          </div>
        }
        <div className="flex gap-2 w-full min-w-0">
          <Button
            variant={userEffectiveVote === 'pro' ? 'default' : 'outline'}
            onClick={() => handleVote('pro')}
            disabled={voteMutation.isPending || readOnly}
            onMouseEnter={() => setHoverVote('pro')}
            onMouseLeave={() => setHoverVote(null)}
            className={`flex-1 min-w-0 h-10 md:h-12 text-sm md:text-base font-semibold rounded-xl transition-all duration-200 px-2 md:px-4 ${
            userEffectiveVote === 'pro' ?
            'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200' :
            'border-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400'}`
            }>
            
            <ThumbsUp className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="truncate">{isHe ? 'בעד' : isAr ? 'مع' : 'Pro'}</span>
            {proCount > 0 && <span className="text-xs md:text-sm opacity-80 shrink-0">({proCount})</span>}
          </Button>
          <Button
            variant={userEffectiveVote === 'con' ? 'default' : 'outline'}
            onClick={() => handleVote('con')}
            disabled={voteMutation.isPending || readOnly}
            onMouseEnter={() => setHoverVote('con')}
            onMouseLeave={() => setHoverVote(null)}
            className={`flex-1 min-w-0 h-10 md:h-12 text-sm md:text-base font-semibold rounded-xl transition-all duration-200 px-2 md:px-4 ${
            userEffectiveVote === 'con' ?
            'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200' :
            'border-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-400'}`
            }>
            
            <ThumbsDown className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="truncate">{isHe ? 'נגד' : isAr ? 'ضد' : 'Con'}</span>
            {conCount > 0 && <span className="text-xs md:text-sm opacity-80 shrink-0">({conCount})</span>}
          </Button>
        </div>

      </div>

      <Dialog open={showConDialog} onOpenChange={(open) => { if (!open && !suggestTransition) setShowConDialog(false); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden gap-0" onClick={(e) => e.stopPropagation()}>
          {suggestTransition ? (
            <div className="flex flex-col items-center text-center px-6 py-10 space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <ThumbsDown className="w-7 h-7 text-red-600" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {suggestTransitionHadComment
                  ? (isHe ? 'תגובתך פורסמה והתנגדותך התקבלה' : isAr ? 'تم نشر تعليقك واستلام اعتراضك' : 'Your comment was posted and objection received')
                  : (isHe ? 'ההתנגדות התקבלה' : isAr ? 'تم استلام الاعتراض' : 'Your objection was received')}
              </DialogTitle>
              <p className="text-sm text-slate-500 leading-relaxed">
                {isHe ? 'מעבר לחלון להזנת הצעת עריכה לסעיף…' : isAr ? 'جارٍ الانتقال إلى نافذة إدخال اقتراح تعديل للقسم…' : 'Taking you to the edit suggestion screen…'}
              </p>
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
          <>
          {/* Header with icon */}
          <DialogHeader className="items-center text-center px-6 pt-6 pb-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {isHe ? 'הצבעת נגד הסעיף' : isAr ? 'التصويت ضد القسم' : 'Vote against this section'}
            </DialogTitle>
            <p className="text-sm text-slate-500 leading-relaxed">
              {isHe ? 'הצבעתך תקרב את הסרת הסעיף מהמסמך. באפשרותך:' : isAr ? 'سيقرّب تصويتك إزالة القسم من الوثيقة' : 'Your vote will bring this section closer to removal'}
            </p>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-3">
            {/* Option 1: Vote against only */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleConVoteOnly}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm gap-2"
              >
                <ThumbsDown className="w-4 h-4 shrink-0" />
                {isHe ? 'להצביע נגד בלבד' : isAr ? 'صوّت ضد' : 'Vote against'}
              </Button>
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">1</span>
            </div>

            {/* Option 2: Add explanation (optional) */}
            {!showExplanation ? (
              <button
                type="button"
                onClick={() => {
                  setShowExplanation(true);
                  setTimeout(() => explanationRef.current?.focus(), 250);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors text-sm font-medium"
              >
                <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </span>
                {isHe ? 'להוסיף הסבר להתנגדותך (אופציונלי)' : isAr ? 'إضافة توضيح أو صياغة بديلة (اختياري)' : 'Add an explanation or alternative wording (optional)'}
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <label className="text-sm text-slate-500">
                      {isHe ? 'מה לא עובד בסעיף הזה? ניתן להוסיף הסבר להתנגדות או להציע לו נוסח חלופי (אופציונלי)' : isAr ? 'ما الخطأ في هذا القسم؟ يمكنك أيضاً اقتراح صياغة أخرى (اختياري)' : 'What doesn\'t work in this section? You can also suggest how to word it differently (optional)'}
                    </label>
                  </div>
                  <Textarea
                    ref={explanationRef}
                    value={conComment}
                    onChange={(e) => setConComment(e.target.value)}
                    placeholder={isHe ? 'מה הסיבה להתנגדות לסעיף?' : isAr ? 'لماذا تعارض هذا القسم؟' : 'Why do you oppose this section?'}
                    className="min-h-[90px] resize-none rounded-xl border-slate-200 focus-visible:ring-red-200"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  <p className="text-xs text-slate-500 text-center leading-tight">
                    {isHe ? 'ההסבר יפורסם כתגובה יחד עם הצבעתך נגד' : isAr ? 'سيُنشر توضيحك كتعليق مع تصويتك ضد' : 'Your explanation will be posted as a comment together with your con vote'}
                  </p>
                  <Button
                    onClick={handleConVoteOnly}
                    className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm gap-2"
                  >
                    <ThumbsDown className="w-4 h-4 shrink-0" />
                    {isHe ? 'הצבע נגד ופרסם' : isAr ? 'صوّت ضد وانشر' : 'Vote against & publish'}
                  </Button>
                </motion.div>
              </AnimatePresence>
            )}

            {/* Option 3: Suggest alternative wording */}
            <button
              type="button"
              onClick={handleConVoteAndSuggest}
              className="w-full rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors p-3 text-start"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Pencil className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-tight">
                    {isHe ? 'להציע נוסח חלופי לסעיף' : isAr ? 'اقتراح صياغة بديلة للقسم' : 'Suggest alternative wording'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                    {isHe
                      ? (conComment.trim()
                        ? 'תגובתך תפורסם, ההתנגדות תירשם ותועבר/י למסך לכתיבת הצעה לעריכת הסעיף'
                        : 'ההצבעה נגד תירשם ותועבר/י למסך כתיבת נוסח חלופי')
                      : isAr ? 'سيُسجّل تصويتك ضد وسيتم نقلك لكتابة صياغة بديلة' : 'Your con vote is recorded and you\'ll write a new version'}
                  </p>
                </div>
                {isRTL ? <ArrowLeft className="w-4 h-4 text-slate-400 shrink-0" /> : <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />}
              </div>
            </button>
          </div>
          </>
          )}
        </DialogContent>
      </Dialog>
    </div>);

}