import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { CarouselNavigationArrows } from "@/components/document/section-carousel/CarouselNavigation";
import CarouselTitleInline from "@/components/document/section-carousel/CarouselTitleInline";
import ChangeBlockDiffView from "@/components/document/ChangeBlockDiffView";
import VotingProgressSection from "@/components/document/VotingProgressSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  LogIn,
  MessageSquare } from
"lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import usePlatformCtas from "./usePlatformCtas";

// The sample card is assembled from the real building blocks of a document's
// suggestion carousel — header line, change-block diff, voting progress and the
// paging strip — so it shows exactly what an edit-suggestion looks like in the app.
const THRESHOLD = 17;

function ProposalCard({ c, isRTL }) {
  const { t, language } = useLanguage();
  const [navIndex, setNavIndex] = useState(0);

  // Each paging step is a different proposal to change the same section.
  const views = c.cardViews;
  const view = views[navIndex] || views[0];

  const navViews = useMemo(
    () =>
    views.map((item, i) => ({
      id: `example-suggestion-${i}`,
      type: "suggestion",
      data: {
        type: "edit_section",
        created_by_id: `example-author-${i}`,
        created_date: item.createdDate,
      },
    })),
    [views]
  );

  const currentView = navViews[navIndex];
  const getUserName = (id) => views[Number(String(id).split("-").pop())]?.author || "";
  const goTo = (index) => setNavIndex((index + navViews.length) % navViews.length);

  const suggestion = {
    id: currentView.id,
    type: "edit_section",
    status: "pending",
    proVotes: view.proVotes,
    conVotes: view.conVotes,
    created_by_id: currentView.data.created_by_id,
    created_date: view.createdDate,
  };

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-3 transition-all duration-300 hover:border-amber-400 hover:shadow-md md:p-6">
      {/* Section number + position, then the real proposal header line */}
      <div className="mb-3 flex items-center justify-between gap-2 md:mb-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <div className="flex flex-shrink-0 flex-col items-start gap-0.5">
            <div className="text-xs font-medium text-slate-500 md:text-sm">
              {t("section")} 3
            </div>
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] md:text-xs">
              {navIndex + 1} / {views.length}
            </Badge>
          </div>
          <CarouselTitleInline
            currentView={currentView}
            language={language}
            getUserName={getUserName} />
          
        </div>
      </div>

      {/* Proposed wording — the real change-block diff */}
      <div className="rounded-lg border border-slate-300 bg-white p-3">
        <ChangeBlockDiffView originalContent={c.cardOriginal} newContent={view.proposed} />
      </div>

      {view.explanation &&
      <div className="mt-3">
          <div className="mb-1 font-semibold text-slate-700">{t("explanation")}:</div>
          <p className="text-sm text-slate-600">{view.explanation}</p>
        </div>
      }

      <div className="mt-4 space-y-2">
        <VotingProgressSection
          suggestion={suggestion}
          document={{ threshold: THRESHOLD }}
          userVote={null}
          voteMutation={{ isPending: false, mutate: () => {} }}
          isRTL={isRTL} />
        

        <div className={`mt-2 flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 gap-1.5 px-3 text-sm ${isRTL ? "mr-auto" : "ml-auto"} ${
            view.comments > 0 ?
            "border-blue-300 bg-blue-50 font-semibold text-blue-700" :
            "text-slate-600"}`
            }>
            
            <MessageSquare className={`h-4 w-4 ${view.comments > 0 ? "fill-blue-200" : ""}`} />
            {t("comments")}{view.comments > 0 ? ` (${view.comments})` : ""}
          </Button>
        </div>
      </div>

      {/* Paging between proposals — the real carousel navigation strip */}
      <CarouselNavigationArrows
        currentView={currentView}
        allViews={navViews}
        currentIndex={navIndex}
        isRTL={isRTL}
        language={language}
        onPrev={() => goTo(navIndex - 1)}
        onNext={() => goTo(navIndex + 1)}
        onSelectView={(id) => setNavIndex(navViews.findIndex((v) => v.id === id))}
        onReturnToCurrent={() => setNavIndex(0)}
        isOnCurrentView={false}
        getUserName={getUserName}
        t={t} />
      
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
          <div className="min-w-0">
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

          {/* Shrunk to ~65% of a real document card so it stays a compact
              illustration instead of taking over the page. `zoom` scales the
              whole card (and its layout box), the width compensates so it still
              fills the column cleanly. */}
          <div className="w-full" style={{ zoom: 0.65, width: "153.85%" }}>
            <ProposalCard c={c} isRTL={isRTL} />
          </div>
        </div>
      </div>
    </section>);

}