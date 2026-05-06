import React, { useState } from "react";
import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * VotingProgressSection
 * Shows a progress bar toward the acceptance threshold + full-width vote buttons.
 */
export default function VotingProgressSection({ suggestion, document, userVote, voteMutation, isRTL, readOnly = false }) {
  const { t, language } = useLanguage();

  const proVotes = suggestion.proVotes || 0;
  const conVotes = suggestion.conVotes || 0;
  const threshold = Math.max(2, document?.threshold || 2);
  const delta = proVotes - conVotes;

  // How many more pro votes needed
  const votesNeeded = Math.max(0, threshold - delta);
  const passed = delta >= threshold;

  // Progress: 0% = delta of 0 (or negative), 100% = delta >= threshold
  // Map [0, threshold] to [0%, 100%], clamped
  const progressPercent = Math.min(100, Math.max(0, (delta / threshold) * 100));

  // Simulate what a pro/con vote would do
  const afterProDelta = delta + (userVote?.vote === 'pro' ? 0 : userVote?.vote === 'con' ? 2 : 1);
  const afterConDelta = delta + (userVote?.vote === 'con' ? 0 : userVote?.vote === 'pro' ? -2 : -1);
  const afterProProgress = Math.min(100, Math.max(0, (afterProDelta / threshold) * 100));
  const afterConProgress = Math.min(100, Math.max(0, (afterConDelta / threshold) * 100));

  const [hoverVote, setHoverVote] = React.useState(null); // 'pro' | 'con' | null

  const displayProgress = hoverVote === 'pro'
    ? afterProProgress
    : hoverVote === 'con'
    ? afterConProgress
    : progressPercent;

  const barColor = passed
    ? 'bg-green-500'
    : readOnly
    ? 'bg-red-400'
    : hoverVote === 'pro'
    ? 'bg-blue-500'
    : hoverVote === 'con'
    ? 'bg-red-400'
    : 'bg-blue-400';

  const statusText = readOnly
    ? passed
      ? (language === 'he' ? '✓ עבר את סף הקונצנזוס!' : language === 'ar' ? '✓ تجاوز عتبة الإجماع!' : '✓ Passed consensus threshold!')
      : (language === 'he' ? `לא הגיע לסף — חסרו ${votesNeeded} תומכים` : language === 'ar' ? `لم يصل للعتبة — نقص ${votesNeeded} مؤيدين` : `Did not reach threshold — ${votesNeeded} supporters short`)
    : passed
    ? (language === 'he' ? '✓ עבר את סף הקונצנזוס!' : language === 'ar' ? '✓ تجاوز عتبة الإجماع!' : '✓ Passed consensus threshold!')
    : hoverVote === 'pro'
    ? (language === 'he' ? `הצבעתך תקרב את ההצעה לאישור` : language === 'ar' ? 'سيقرب صوتك الاقتراح من القبول' : 'Your vote will help pass this proposal')
    : hoverVote === 'con'
    ? (language === 'he' ? `הצבעתך תרחיק את ההצעה מאישור` : language === 'ar' ? 'سيبعد صوتك الاقتراح عن القبول' : 'Your vote will push back the proposal')
    : votesNeeded === 1
    ? (language === 'he' ? `עוד הצבעת בעד אחת חסרה לאישור` : language === 'ar' ? 'مطلوب مؤيد واحد فقط للموافقة' : '1 more supporter needed')
    : (language === 'he' ? `עוד ${votesNeeded} תומכים דרושים לאישור` : language === 'ar' ? `${votesNeeded} مؤيدين إضافيين مطلوبين للموافقة` : `${votesNeeded} more supporters needed`);

  return (
    <div className="space-y-3">
      {/* Progress bar section */}
      <Link
        to={`${createPageUrl("UnderstandingConsensus")}?id=${document?.id}`}
        className="block group"
        title={language === 'he' ? 'למדו על מנגנון הקונצנזוס' : 'Learn about consensus'}
      >
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 group-hover:border-blue-200 transition-colors">
          {/* Labels row */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">
              {language === 'he' ? 'התקדמות לאישור' : language === 'ar' ? 'تقدم نحو القبول' : 'Progress to acceptance'}
            </span>
            <span className={`text-xs font-bold ${passed ? 'text-green-600' : 'text-slate-500'}`}>
              {passed ? '✓' : `${Math.max(0, delta)}/${threshold}`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
            
            <motion.div
              className={`h-full rounded-full ${barColor} transition-colors duration-300`}
              initial={false}
              animate={{ width: `${displayProgress}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>

          {/* Status text */}
          <motion.p
            key={statusText}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-xs mt-2 text-center font-medium ${
              passed ? 'text-green-600' :
              hoverVote === 'pro' ? 'text-blue-600' :
              hoverVote === 'con' ? 'text-red-500' :
              'text-slate-500'
            }`}
          >
            {statusText}
          </motion.p>
        </div>
      </Link>

      {/* User vote indicator - shown in read-only mode when user voted */}
      {readOnly && userVote && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border ${userVote.vote === 'pro' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {userVote.vote === 'pro' ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
          <span>
            {language === 'he'
              ? `הצבעת ${userVote.vote === 'pro' ? 'בעד' : 'נגד'}`
              : language === 'ar'
              ? `صوّتت ${userVote.vote === 'pro' ? 'مع' : 'ضد'}`
              : `You voted ${userVote.vote === 'pro' ? 'Pro' : 'Con'}`}
          </span>
        </div>
      )}

      {/* Vote buttons - full width (hidden in read-only mode) */}
      {!readOnly && <div className="relative">
        {voteMutation.isPending && (
          <div className="absolute inset-0 bg-white/60 rounded-xl flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}
        <div className="flex gap-2 w-full min-w-0">
          <Button
            variant={userVote?.vote === 'pro' ? 'default' : 'outline'}
            onClick={() => voteMutation.mutate('pro')}
            disabled={voteMutation.isPending}
            onMouseEnter={() => setHoverVote('pro')}
            onMouseLeave={() => setHoverVote(null)}
            className={`flex-1 min-w-0 h-10 md:h-12 text-sm md:text-base font-semibold rounded-xl transition-all duration-200 px-2 md:px-4 ${
              userVote?.vote === 'pro'
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200'
                : 'border-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400'
            }`}
          >
            <ThumbsUp className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="truncate">{t('votePro')}</span>
            {proVotes > 0 && (
              <span className="text-xs md:text-sm opacity-80 shrink-0">({proVotes})</span>
            )}
          </Button>
          <Button
            variant={userVote?.vote === 'con' ? 'default' : 'outline'}
            onClick={() => voteMutation.mutate('con')}
            disabled={voteMutation.isPending}
            onMouseEnter={() => setHoverVote('con')}
            onMouseLeave={() => setHoverVote(null)}
            className={`flex-1 min-w-0 h-10 md:h-12 text-sm md:text-base font-semibold rounded-xl transition-all duration-200 px-2 md:px-4 ${
              userVote?.vote === 'con'
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200'
                : 'border-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-400'
            }`}
          >
            <ThumbsDown className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="truncate">{t('voteCon')}</span>
            {conVotes > 0 && (
              <span className="text-xs md:text-sm opacity-80 shrink-0">({conVotes})</span>
            )}
          </Button>
        </div>
        {userVote && (
          <p className="text-center text-xs text-slate-400 mt-1.5">
            {userVote.vote === 'pro'
              ? (language === 'he' ? 'הצבעת בעד • לחץ/י שוב לביטול' : language === 'ar' ? 'صوتك مع • اضغط مجدداً للإلغاء' : 'You voted pro • click again to remove')
              : (language === 'he' ? 'הצבעת נגד • לחץ/י שוב לביטול' : language === 'ar' ? 'صوتك ضد • اضغط مجدداً للإلغاء' : 'You voted con • click again to remove')}
          </p>
        )}
      </div>}
    </div>
  );
}