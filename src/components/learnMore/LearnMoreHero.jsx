import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

function ProposalCard({ c }) {
  const pro = 14;
  const con = 5;
  const threshold = 8;
  const total = pro + con;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur-sm md:p-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {c.cardLabel}
      </div>
      <p className="mt-3 text-base font-semibold leading-snug text-slate-900 md:text-lg">
        {c.cardTitle}
      </p>

      <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <span className="h-full bg-emerald-500" style={{ width: `${(pro / total) * 100}%` }} />
        <span className="h-full bg-rose-500" style={{ width: `${(con / total) * 100}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-200 bg-slate-50 py-2">
          <div className="text-lg font-bold text-emerald-600">{pro}</div>
          <div className="text-xs text-slate-500">{c.cardPro}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 py-2">
          <div className="text-lg font-bold text-rose-600">{con}</div>
          <div className="text-xs text-slate-500">{c.cardCon}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 py-2">
          <div className="text-lg font-bold text-blue-600">{threshold}</div>
          <div className="text-xs text-slate-500">{c.cardThreshold}</div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{c.cardResult}</span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{c.cardFootnote}</p>
    </div>
  );
}

export default function LearnMoreHero({ c, isRTL }) {
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10" />

      <div className="relative mx-auto max-w-7xl px-6 py-10 md:py-16">
        <Link
          to={createPageUrl("Home")}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-blue-700"
        >
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
              <Link to={createPageUrl("Home")}>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {c.primaryCta}
                </Button>
              </Link>
              <Link to={createPageUrl("CreateDocument")}>
                <Button size="lg" variant="outline">
                  {c.secondaryCta}
                </Button>
              </Link>
            </div>

            <p className="mt-5 flex items-start gap-2 text-sm text-slate-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
              <span>{c.note}</span>
            </p>
          </div>

          <ProposalCard c={c} />
        </div>
      </div>
    </section>
  );
}