import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { fmt } from "@/components/learnMore/consensus-lab/demoStages";
import useAnimatedNumber from "@/components/learnMore/consensus-lab/useAnimatedNumber";

/**
 * The two figures this edit turned on, side by side — what was required, and
 * where the document's consensus meter now stands. The meter counts up from
 * where it was, so stepping into the stage shows the document moving rather
 * than a number appearing. The section's own score stays, quieter, underneath.
 */
export default function EditStats({ s, stage }) {
  const meter = useAnimatedNumber(stage.meter, stage.meterAfter);
  const dropped = stage.trend === "down";
  const TrendIcon = dropped ? TrendingDown : TrendingUp;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 py-2">
      <dl className="grid grid-cols-2 divide-x divide-slate-200 rtl:divide-x-reverse">
        <div className="min-w-0 px-2 text-center">
          <dt className="text-xs font-medium leading-tight text-slate-600">{s.thresholdLabel}</dt>
          <dd className="mt-1 text-base font-bold tabular-nums text-slate-900">
            <bdi>{fmt(stage.threshold)}</bdi>
            <span className="ms-1 text-xs font-medium text-slate-600">{s.supporters}</span>
          </dd>
        </div>

        <div className="min-w-0 px-2 text-center">
          <dt className="text-xs font-medium leading-tight text-slate-600">{s.levelLabel}</dt>
          <dd className="mt-1 flex items-baseline justify-center gap-1 text-base font-bold tabular-nums">
            {/* where the meter stood before this edit */}
            <bdi className="text-xs font-semibold text-slate-400 line-through">
              {stage.meter}%
            </bdi>
            <ArrowRight
              className="h-3 w-3 shrink-0 self-center text-slate-300 rtl:rotate-180"
              aria-hidden="true"
            />
            <bdi className={dropped ? "text-rose-700" : "text-emerald-700"}>
              {Math.round(meter)}%
            </bdi>
            <TrendIcon
              className={`h-3.5 w-3.5 shrink-0 self-center ${
                dropped ? "text-rose-600" : "text-emerald-600"
              }`}
              aria-label={dropped ? s.downLabel : s.upLabel}
            />
          </dd>
        </div>
      </dl>

      <p className="mt-1.5 border-t border-slate-200 pt-1.5 text-center text-[11px] leading-none text-slate-500">
        {s.scoreLabel}:{" "}
        <bdi className="font-semibold tabular-nums text-slate-600">{stage.score}%</bdi>
      </p>
    </div>
  );
}