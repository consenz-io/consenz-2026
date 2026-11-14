import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";

const TONES = [
  "bg-amber-50 text-amber-800",
  "bg-sky-50 text-sky-800",
  "bg-emerald-50 text-emerald-800",
];

/**
 * Where the document sits after this edit: the meter before, the meter after,
 * and what that position means for the wording. The meter can move both ways —
 * an accepted proposal can pull it down as well.
 */
export default function ConsensusTrail({ s, stage, stateIndex }) {
  const clamped = Math.min(100, Math.max(0, stage.meterAfter));
  const dropped = stage.trend === "down";

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {s.levelLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-800">
          <bdi>{stage.meter}%</bdi>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180" aria-hidden="true" />
          <bdi className={dropped ? "text-rose-700" : "text-emerald-700"}>{stage.meterAfter}%</bdi>
          {dropped ? (
            <TrendingDown className="h-4 w-4 text-rose-600" aria-label={s.downLabel} />
          ) : (
            <TrendingUp className="h-4 w-4 text-emerald-600" aria-label={s.upLabel} />
          )}
        </span>
      </div>

      <div className="relative mt-2 h-2.5 rounded-full bg-gradient-to-r from-amber-200 via-sky-200 to-emerald-300 rtl:bg-gradient-to-l">
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-all duration-500 rtl:translate-x-1/2"
          style={{
            insetInlineStart: `${clamped}%`,
            backgroundColor: dropped ? "#e11d48" : "#0f172a",
          }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-1 flex justify-between gap-3 text-[10px] text-slate-500">
        <span>{s.dynamicPole}</span>
        <span className="text-end">{s.stablePole}</span>
      </div>

      <span
        className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONES[stateIndex]}`}
      >
        {s.stateLabels[stateIndex]}
      </span>
    </div>
  );
}