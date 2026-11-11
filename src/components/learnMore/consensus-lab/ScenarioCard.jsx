import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";

/** One of the two outcomes of the same vote: the numbers, then the meter. */
export default function ScenarioCard({ s, title, scenario }) {
  const up = scenario.change >= 0;
  const c = s.compare;
  const rows = [
    { label: c.votesLabel, value: scenario.pro, second: scenario.con, tone: "text-emerald-700" },
    { label: c.marginLabel, value: scenario.gap, second: scenario.threshold, tone: "text-slate-800" },
    { label: c.scoreLabel, value: `${scenario.score}%`, tone: "text-slate-900" },
  ];

  return (
    <div
      className={`rounded-xl border-2 p-4 ${up ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50"}`}
    >
      <p className="text-sm font-bold leading-snug text-slate-900">{title}</p>

      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2">
            <dt className="min-w-0 truncate text-slate-500">{row.label}</dt>
            <dd className={`shrink-0 font-bold tabular-nums ${row.tone}`}>
              <bdi>{row.value}</bdi>
              {row.second !== undefined && (
                <>
                  <span className="mx-1 font-normal text-slate-300" aria-hidden="true">
                    /
                  </span>
                  <bdi>{row.second}</bdi>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-white/90 px-3 py-2">
        <span className="text-xs font-semibold text-slate-500">{c.meterLabel}</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-800">
          <bdi>{scenario.meterBefore}%</bdi>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180" aria-hidden="true" />
          <bdi className={up ? "text-emerald-700" : "text-rose-700"}>{scenario.meterAfter}%</bdi>
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${up ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
          >
            {up ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            <bdi>{scenario.change > 0 ? `+${scenario.change}` : scenario.change}</bdi>
          </span>
        </span>
      </div>
    </div>
  );
}