import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

function ProposalCard({ c }) {
  const pro = 14;
  const con = 5;
  const threshold = 8;
  const total = pro + con;
  const proWidth = `${(pro / total) * 100}%`;
  const conWidth = `${(con / total) * 100}%`;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-sm md:p-6">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-blue-300">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {c.cardLabel}
      </div>
      <p className="mt-3 text-base font-semibold leading-snug text-white md:text-lg">
        {c.cardTitle}
      </p>

      <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <span className="h-full bg-emerald-400/80" style={{ width: proWidth }} />
        <span className="h-full bg-rose-400/80" style={{ width: conWidth }} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/5 py-2">
          <div className="text-lg font-bold text-emerald-300">{pro}</div>
          <div className="text-[11px] text-slate-400">{c.cardPro}</div>
        </div>
        <div className="rounded-xl bg-white/5 py-2">
          <div className="text-lg font-bold text-rose-300">{con}</div>
          <div className="text-[11px] text-slate-400">{c.cardCon}</div>
        </div>
        <div className="rounded-xl bg-white/5 py-2">
          <div className="text-lg font-bold text-blue-300">{threshold}</div>
          <div className="text-[11px] text-slate-400">{c.cardThreshold}</div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-300">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{c.cardResult}</span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">{c.cardFootnote}</p>
    </div>
  );
}

export default function LearnMoreHero({ c, isRTL }) {
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <section className="relative overflow-hidden bg-slate-900 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 85% 0%, rgba(59,130,246,0.28), transparent 70%), radial-gradient(45% 45% at 0% 100%, rgba(99,102,241,0.22), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-20">
        <Link
          to={createPageUrl("Home")}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-slate-300 transition-colors hover:border-white/30 hover:text-white"
        >
          <BackIcon className="h-4 w-4" aria-hidden="true" />
          {c.back}
        </Link>

        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <span className="inline-flex items-center rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold tracking-wide text-blue-200 ring-1 ring-inset ring-blue-400/30">
              {c.badge}
            </span>
            <h1
              className="mt-5 text-3xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-[3.4rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {c.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
              {c.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={createPageUrl("Home")}>
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                  {c.primaryCta}
                </Button>
              </Link>
              <Link to={createPageUrl("CreateDocument")}>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  {c.secondaryCta}
                </Button>
              </Link>
            </div>

            <p className="mt-5 flex items-start gap-2 text-sm text-slate-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />
              <span>{c.note}</span>
            </p>
          </div>

          <ProposalCard c={c} />
        </div>
      </div>
    </section>
  );
}