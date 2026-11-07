import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowUpRight, Equal } from "lucide-react";

export default function ConsensusExplainer({ c }) {
  return (
    <section
      id="consensus-calculation"
      dir="inherit"
      className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14 md:px-8 md:py-20"
    >
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
            {c.overline}
          </p>
          <h2
            className="mt-3 text-2xl font-bold leading-tight tracking-tight text-foreground md:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {c.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{c.subtitle}</p>
          <Link
            to={createPageUrl("UnderstandingConsensus")}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
          >
            {c.link}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ol className="space-y-3">
          {c.formulas.map((formula, index) => (
            <li
              key={formula.title}
              className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">{formula.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{formula.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl bg-slate-900 text-white md:mt-10">
        <div className="grid items-center gap-6 p-6 md:grid-cols-[auto_1fr] md:p-8">
          <div className="flex flex-col items-start gap-2 rounded-2xl bg-white/[0.06] px-6 py-5 text-center">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-blue-300">
              {c.exampleLabel}
            </span>
            <div className="flex items-center gap-2 text-xl font-bold tabular-nums md:text-2xl" dir="ltr">
              <span className="text-blue-300">50%</span>
              <span className="text-slate-500">×</span>
              <span className="text-slate-300">20</span>
              <Equal className="h-5 w-5 text-slate-500" aria-hidden="true" />
              <span className="text-emerald-300">10</span>
            </div>
          </div>
          <div>
            <p className="text-base leading-relaxed text-slate-200 md:text-lg">{c.exampleText}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{c.exampleNote}</p>
          </div>
        </div>
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400" />
      </div>
    </section>
  );
}