import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowUpRight, Equal } from "lucide-react";

export default function ConsensusExplainer({ c }) {
  return (
    <section
      id="consensus-calculation"
      dir="inherit"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-14 md:py-16"
    >
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            {c.overline}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-900">{c.title}</h2>
          <p className="mt-3 text-slate-600">{c.subtitle}</p>
          <Link
            to={createPageUrl("UnderstandingConsensus")}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
          >
            {c.link}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ol className="space-y-3">
          {c.formulas.map((formula, index) => (
            <li
              key={formula.title}
              className="flex gap-4 rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-sm font-bold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-900">{formula.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{formula.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50/60 p-6 md:mt-10 md:p-8">
        <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-blue-200 bg-white px-6 py-5 text-center shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              {c.exampleLabel}
            </span>
            <div className="flex items-center gap-2 text-xl font-bold tabular-nums md:text-2xl" dir="ltr">
              <span className="text-blue-600">50%</span>
              <span className="text-slate-400">×</span>
              <span className="text-slate-600">20</span>
              <Equal className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <span className="text-emerald-600">10</span>
            </div>
          </div>
          <div>
            <p className="text-base leading-relaxed text-slate-700 md:text-lg">{c.exampleText}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.exampleNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}