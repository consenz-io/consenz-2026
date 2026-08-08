import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Clock, ShieldX, Timer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useLanguage } from "@/components/LanguageContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CounterTooltip from "./CounterTooltip";

function useTimeRemaining(timerEndsAt) {
  const [remaining, setRemaining] = React.useState(() => {
    if (!timerEndsAt) return null;
    return Math.max(0, new Date(timerEndsAt) - Date.now());
  });

  useEffect(() => {
    if (!timerEndsAt) return;
    const tick = () => setRemaining(Math.max(0, new Date(timerEndsAt) - Date.now()));
    tick();
    const id = setInterval(tick, 60000); // update every minute
    return () => clearInterval(id);
  }, [timerEndsAt]);

  return remaining;
}

function formatRemaining(ms, language) {
  if (ms === null) return null;
  if (ms <= 0) return language === 'he' ? 'פג תוקף' : language === 'ar' ? 'انتهت' : 'Expired';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 2) return language === 'he' ? `${days} ימים` : language === 'ar' ? `${days} أيام` : `${days}d`;
  if (hours >= 1) return language === 'he' ? `${hours} שע'` : language === 'ar' ? `${hours} س` : `${hours}h`;
  return language === 'he' ? `${totalMinutes} דק'` : language === 'ar' ? `${totalMinutes} د` : `${totalMinutes}m`;
}

/**
 * VotingProgressSection
 * Shows a progress bar toward the acceptance threshold + full-width vote buttons.
 */
export default function VotingProgressSection({ suggestion, document, userVote, voteMutation, isRTL, readOnly = false, onLoginRequired, acceptedDate, rejectedDate, rejectedByAdmin, sourceSuggestion }) {
  const { t, language } = useLanguage();
  const msRemaining = useTimeRemaining(suggestion?.timerEndsAt);
  const timeLabel = formatRemaining(msRemaining, language);
  const isUrgent = msRemaining !== null && msRemaining > 0 && msRemaining < 6 * 60 * 60 * 1000; // < 6 hours

  // Check if timer has expired on the frontend (even if status is still 'pending' — cron may not have run yet)
  const isTimerExpired = suggestion?.timerEndsAt && new Date(suggestion.timerEndsAt) <= new Date();
  // Treat as effectively read-only if expired
  const effectiveReadOnly = readOnly || isTimerExpired;

  // For accepted suggestions, freeze the threshold at what it was at acceptance time.
  // At the moment of acceptance, delta >= threshold exactly, so delta itself is the frozen threshold.
  const isAccepted = suggestion?.status === 'accepted';
  // delete_section type — the suggestion represents a community vote to remove a section
  const isDeleteSection = suggestion?.type === 'delete_section';
  // Existing section (passed as a plain section without a suggestion status) —
  // already part of the document, so display it as accepted rather than "did not reach threshold".
  const isExistingSection = !suggestion?.status;

  // For an existing section whose content came from an accepted suggestion,
  // use that suggestion's vote counts for the display.
  const proVotes = isExistingSection ?
  sourceSuggestion?.proVotes || 0 :
  suggestion.proVotes || 0;
  const conVotes = isExistingSection ?
  sourceSuggestion?.conVotes || 0 :
  suggestion.conVotes || 0;
  // For delete_section: swap display so "pro" = section supporters, "con" = section opponents
  const displayProVotes = isDeleteSection ? conVotes : proVotes;
  const displayConVotes = isDeleteSection ? proVotes : conVotes;
  const delta = proVotes - conVotes;

  const threshold = isAccepted ?
  Math.max(2, delta) :
  Math.max(2, document?.threshold || 2);

  // How many more pro votes needed
  const votesNeeded = isExistingSection ? 0 : Math.max(0, threshold - delta);
  const passed = isExistingSection || isDeleteSection && isAccepted || delta >= threshold;

  // Progress: 0% = delta of 0 (or negative), 100% = delta >= threshold
  // Map [0, threshold] to [0%, 100%], clamped
  const progressPercent = isExistingSection || isDeleteSection && isAccepted ?
  100 :
  Math.min(100, Math.max(0, delta / threshold * 100));

  // Simulate what a pro/con vote would do
  const afterProDelta = delta + (userVote?.vote === 'pro' ? 0 : userVote?.vote === 'con' ? 2 : 1);
  const afterConDelta = delta + (userVote?.vote === 'con' ? 0 : userVote?.vote === 'pro' ? -2 : -1);
  const afterProProgress = Math.min(100, Math.max(0, afterProDelta / threshold * 100));
  const afterConProgress = Math.min(100, Math.max(0, afterConDelta / threshold * 100));

  const [hoverVote, setHoverVote] = React.useState(null); // 'pro' | 'con' | null

  const displayProgress = hoverVote === 'pro' ?
  afterProProgress :
  hoverVote === 'con' ?
  afterConProgress :
  progressPercent;

  const barColor = passed ?
  isDeleteSection ? 'bg-red-500' : 'bg-green-500' :
  effectiveReadOnly ?
  'bg-red-400' :
  hoverVote === 'pro' ?
  'bg-blue-500' :
  hoverVote === 'con' ?
  'bg-red-400' :
  'bg-blue-400';

  const createdByText = language === 'he' ? 'נוצר על ידי מנהל/ת' : language === 'ar' ? 'أنشئ بواسطة المشرف' : 'Created by admin';
  const acceptedLabel = language === 'he' ? 'התקבלה' : language === 'ar' ? 'تم القبول' : 'Accepted';
  const deletedLabel = language === 'he' ? 'נמחק בהצבעת קהילה' : language === 'ar' ? 'حذف بتصويت المجتمع' : 'Deleted by community vote';
  const datePrefix = language === 'he' ? 'ב-' : language === 'ar' ? 'في ' : 'on ';
  const acceptedVotesText = language === 'he' ?
  `✓ התקבלה — ${proVotes} בעד, ${conVotes} נגד` :
  language === 'ar' ?
  `✓ تم القبول — ${proVotes} مع, ${conVotes} ضد` :
  `✓ Accepted — ${proVotes} pro, ${conVotes} con`;
  const passedText = language === 'he' ? '✓ עבר את סף הקונצנזוס!' : language === 'ar' ? '✓ تجاوز عتبة الإجماع!' : '✓ Passed consensus threshold!';

  // For passed/existing sections the full label + date is shown below the bar,
  // so the status text only carries the checkmark here.
  const passedStatusText = '✓';

  const statusText = effectiveReadOnly ?
  isExistingSection ?
  passedStatusText :
  passed ?
  passedStatusText :
  isTimerExpired && !readOnly ?
  language === 'he' ? `פג תוקף ההצבעה — חסרו ${votesNeeded} תומכים` : language === 'ar' ? `انتهت مدة التصويت — نقص ${votesNeeded} مؤيدين` : `Voting period ended — ${votesNeeded} supporters short` :
  language === 'he' ? `לא הגיע לסף — חסרו ${votesNeeded} תומכים` : language === 'ar' ? `لم يصل للعتبة — نقص ${votesNeeded} مؤيدين` : `Did not reach threshold — ${votesNeeded} supporters short` :
  passed ?
  passedStatusText :
  hoverVote === 'pro' && userVote?.vote === 'pro' ?
  language === 'he' ? 'הצבעת בעד • לחץ/י שוב לביטול' : language === 'ar' ? 'صوتك مع • اضغط مجدداً للإلغاء' : 'You voted pro • click again to remove' :
  hoverVote === 'con' && userVote?.vote === 'con' ?
  language === 'he' ? 'הצבעת נגד • לחץ/י שוב לביטול' : language === 'ar' ? 'صوتك ضد • اضغط مجدداً للإلغاء' : 'You voted con • click again to remove' :
  hoverVote === 'pro' ?
  language === 'he' ? `הצבעתך תקרב את ההצעה לאישור` : language === 'ar' ? 'سيقرب صوتك الاقتراح من القبول' : 'Your vote will help pass this proposal' :
  hoverVote === 'con' ?
  language === 'he' ? `הצבעתך תרחיק את ההצעה מאישור` : language === 'ar' ? 'سيبعد صوتك الاقتراح عن القبول' : 'Your vote will push back the proposal' :
  votesNeeded === 1 ?
  language === 'he' ? `עוד הצבעת בעד אחת חסרה לאישור` : language === 'ar' ? 'مطلوب مؤيد واحد فقط للموافقة' : '1 more supporter needed' :
  language === 'he' ? `עוד ${votesNeeded} תומכים דרושים לאישור` : language === 'ar' ? `${votesNeeded} مؤيدين إضافيين مطلوبين للموافقة` : `${votesNeeded} more supporters needed`;

  // Below-bar date line: "Created by admin on <date>" or "Accepted on <date>"
  const belowBarInfo = (() => {
    if (isExistingSection && !sourceSuggestion) {
      const date = suggestion?.created_date;
      if (!date) return null;
      return { label: createdByText, date };
    }
    if (passed) {
      const date = isDeleteSection ?
      suggestion?.timerEndsAt || acceptedDate || suggestion?.updated_date :
      isExistingSection ?
      sourceSuggestion?.updated_date || acceptedDate :
      acceptedDate || suggestion?.updated_date;
      if (!date) return null;
      return { label: isDeleteSection ? deletedLabel : acceptedLabel, date };
    }
    return null;
  })();

  // Admin-accepted: show a clean status badge instead of the progress bar
  const isAdminAccepted = suggestion?.approvedByAdmin && suggestion?.status === 'accepted';
  if (isAdminAccepted) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 bg-indigo-50 border border-indigo-200 rounded-xl">
        <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="text-sm font-medium text-indigo-700 flex-1">
          {language === 'he' ? 'אושרה על ידי מנהל' : language === 'ar' ? 'تمت الموافقة من المشرف' : 'Approved by admin'}
        </span>
        {acceptedDate &&
        <span className="text-xs text-indigo-400">
            {new Date(acceptedDate).toLocaleString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        }
      </div>);

  }

  return (
    <div className="space-y-3">
      {/* Progress bar section */}
      <CounterTooltip
        text={language === 'he'
          ? `${proVotes} הצבעות בעד ו-${conVotes} הצבעות נגד, ורף התמיכה הדרוש הוא ${threshold} • לחצו למידע נוסף על חישוב מד הקונסנזוס`
          : language === 'ar'
          ? `${proVotes} أصوات مع و-${conVotes} أصوات ضد، وعتبة الدعم المطلوبة هي ${threshold} • انقروا لمزيد من المعلومات حول حساب مقياس الإجماع`
          : `${proVotes} pro votes and ${conVotes} con votes, support threshold is ${threshold} • Click for more info on consensus meter calculation`}>
        <Link
          to={`${createPageUrl("UnderstandingConsensus")}?id=${document?.id}`}
          className="block group">

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 group-hover:border-blue-200 transition-colors" data-tutorial="support-threshold">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">
                {statusText}
              </span>
              {timeLabel && !effectiveReadOnly && (
                <span className={`text-xs font-medium flex items-center gap-1 ${isUrgent ? 'text-red-500' : 'text-slate-400'}`}>
                  <Clock className="w-3 h-3" />
                  {timeLabel}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${displayProgress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            {/* Vote counts and threshold */}
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" />
                {displayProVotes}
              </span>
              <span className="font-medium">
                {language === 'he' ? `סף: ${threshold}` : language === 'ar' ? `العتبة: ${threshold}` : `Threshold: ${threshold}`}
              </span>
              <span className="flex items-center gap-1">
                {displayConVotes}
                <ThumbsDown className="w-3 h-3" />
              </span>
            </div>

            {/* Below-bar info: accepted date or created-by-admin */}
            {belowBarInfo && (
              <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                <span>{belowBarInfo.label} {datePrefix}{new Date(belowBarInfo.date).toLocaleString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
          </div>
      </Link>
      </CounterTooltip>

      {/* Vote buttons - disabled in read-only mode or when timer expired */}
      {effectiveReadOnly ?
      <div className="space-y-2">
        {isTimerExpired && !readOnly &&
        <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-100 border border-slate-200 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-500">
              {language === 'he' ? 'תקופת ההצבעה הסתיימה' : language === 'ar' ? 'انتهت فترة التصويت' : 'Voting period ended'}
            </span>
          </div>
        }
        <div className="flex gap-2 w-full min-w-0">
          <button
            disabled
            className={`flex-1 min-w-0 h-10 md:h-12 text-sm md:text-base font-semibold rounded-xl px-2 md:px-4 flex items-center justify-center gap-2 border-2 transition-none cursor-not-allowed
              ${userVote?.vote === 'pro' ?
            'bg-green-50 border-green-400 text-green-700 opacity-90' :
            'bg-slate-50 border-slate-200 text-slate-400 opacity-60'}`
            }>
            
            <ThumbsUp className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="truncate">{t('votePro')}</span>
            <span className="text-xs md:text-sm shrink-0">({displayProVotes})</span>

          </button>
          <button
            disabled
            className={`flex-1 min-w-0 h-10 md:h-12 text-sm md:text-base font-semibold rounded-xl px-2 md:px-4 flex items-center justify-center gap-2 border-2 transition-none cursor-not-allowed
              ${userVote?.vote === 'con' ?
            'bg-red-50 border-red-400 text-red-700 opacity-90' :
            'bg-slate-50 border-slate-200 text-slate-400 opacity-60'}`
            }>
            
            <ThumbsDown className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="truncate">{t('voteCon')}</span>
            <span className="text-xs md:text-sm shrink-0">({displayConVotes})</span>

          </button>
        </div>
        </div> :

      <div className="relative">
        <div className="flex gap-2 w-full min-w-0">
          <Button
            variant={userVote?.vote === 'pro' ? 'default' : 'outline'}
            onClick={() => voteMutation.mutate('pro')}
            onMouseEnter={() => setHoverVote('pro')}
            onMouseLeave={() => setHoverVote(null)}
            className={`flex-1 min-w-0 h-10 md:h-12 text-sm md:text-base font-semibold rounded-xl transition-all duration-200 px-2 md:px-4 ${
            userVote?.vote === 'pro' ?
            'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200' :
            'border-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400'}`
            }>
            
            <ThumbsUp className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="truncate">{t('votePro')}</span>
            {proVotes > 0 &&
            <span className="text-xs md:text-sm opacity-80 shrink-0">({proVotes})</span>
            }
          </Button>
          <Button
            variant={userVote?.vote === 'con' ? 'default' : 'outline'}
            onClick={() => voteMutation.mutate('con')}
            onMouseEnter={() => setHoverVote('con')}
            onMouseLeave={() => setHoverVote(null)}
            className={`flex-1 min-w-0 h-10 md:h-12 text-sm md:text-base font-semibold rounded-xl transition-all duration-200 px-2 md:px-4 ${
            userVote?.vote === 'con' ?
            'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200' :
            'border-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-400'}`
            }>
            
            <ThumbsDown className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="truncate">{t('voteCon')}</span>
            {conVotes > 0 &&
            <span className="text-xs md:text-sm opacity-80 shrink-0">({conVotes})</span>
            }
          </Button>
        </div>
        





        
      </div>
      }
    </div>);

}