import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  LogIn,
  MessageSquare,
  Sparkles,
  ThumbsDown,
  ThumbsUp } from
"lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import usePlatformCtas from "./usePlatformCtas";

// Mirrors the real proposal card used inside a document
// (amber frame, header with proposer/date, proposal wording box,
// threshold progress bar and vote buttons).
function ProposalCard({ c }) {
  const { t, language } = useLanguage();
  const pro = 3;
  const con = 0;
  const threshold = 17;
  const delta = pro - con;
  const votesNeeded = Math.max(0, threshold - delta);
  const passed = delta >= threshold;
  const progress = Math.min(100, Math.max(0, delta / threshold * 100));

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-3 shadow-sm md:p-6">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-amber-200 pb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {c.cardLabel}
        </span>
        <span className="flex shrink-0 flex-col items-end text-[10px] leading-tight text-slate-400">
          <span>{c.cardDate}</span>
          <span>{c.cardTime}</span>
        </span>
      </div>

      <p className="text-sm font-bold text-slate-800">{c.cardTitle}</p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{t("proposedChanges")}</span>
        <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700">
          1 / 4
        </Badge>
      </div>
      <div className="mt-1 rounded border border-amber-200 bg-white/80 p-3 text-sm leading-relaxed text-slate-800">
        {c.cardBody}
      </div>

      {/* Support threshold progress — same layout as the real card */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="relative h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`absolute inset-y-0 start-0 rounded-full ${passed ? "bg-green-500" : "bg-blue-400"}`}
            style={{ width: `${progress}%` }} />
          
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
            {pro}
          </span>
          <span className="font-medium">
            {c.cardThreshold}: {threshold}
          </span>
          <span className="flex items-center gap-1">
            {con}
            <ThumbsDown className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-2 text-center text-xs font-medium text-slate-500">
          {passed ? `✓ ${c.cardResult}` : t("votesNeededToPass", { count: votesNeeded })}
        </p>
      </div>

      <div className="mt-2 flex gap-2">
        <div className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-green-200 px-2 text-sm font-semibold text-green-700">
          <ThumbsUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{t("votePro")}</span>
          <span className="text-xs opacity-80">({pro})</span>
        </div>
        <div className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-200 px-2 text-sm font-semibold text-red-700">
          <ThumbsDown className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{t("voteCon")}</span>
        </div>
      </div>

      {/* Suggestion navigation strip — mirrors the arrows and dot indicators
          used to move between proposals in the real carousel */}
      <img
        src="https://media.base44.com/images/public/69ef99e5583af6a64ca3772e/241a2aa7e_generated_28bcf7da.png"
        alt={
        language === 'he' ?
        'המחשת כפתורי הדפדוף בין ההצעות וסימוני המיקום' :
        language === 'ar' ?
        'رسم توضيحي لأزرار التنقل بين الاقتراحات ومؤشرات الموضع' :
        'Illustration of the arrows for moving between proposals and the position dots'
        }
        className="mt-3 w-full select-none rounded-lg"
        loading="lazy" />

      <div className="mt-2 flex items-center justify-end">
        


        
      </div>

      
    </div>);

}

export default function LearnMoreHero({ c, isRTL }) {
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const { user, startTour, signIn } = usePlatformCtas();

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10" />

      <div className="relative mx-auto max-w-7xl px-6 py-10 md:py-16">
        <Link
          to={createPageUrl("Home")}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-blue-700">
          
          <BackIcon className="h-4 w-4" aria-hidden="true" />
          {c.back}
        </Link>

        <div className="mt-8 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <Badge className="border border-blue-200 bg-blue-100 px-4 py-2 text-blue-700">
              {c.badge}
            </Badge>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
              {c.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
              {c.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={startTour}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                
                <Compass className="h-4 w-4" aria-hidden="true" />
                {c.primaryCta}
              </Button>
              {!user &&
              <Button size="lg" variant="outline" onClick={signIn}>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  {c.secondaryCta}
                </Button>
              }
            </div>

            <p className="mt-5 flex items-start gap-2 text-sm text-slate-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
              <span>{c.note}</span>
            </p>
          </div>

          <ProposalCard c={c} />
        </div>
      </div>
    </section>);

}