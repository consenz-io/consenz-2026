import { AlertCircle, CheckCircle2 } from "lucide-react";
import { fill } from "@/components/learnMore/consensus-lab/demoStages";

/**
 * The threshold, how it was computed, and how far the current for-minus-against
 * gap is from reaching it — the same instrument the document's voting section
 * shows, with the arithmetic spelled out underneath.
 */
export default function ThresholdPanel({ s, stage }) {
  const ratio =
    stage.threshold > 0 ? Math.min(1, Math.max(0, stage.gap / stage.threshold)) : 0;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
      aria-label={s.thresholdLabel}
    >
      <h4 className="text-sm font-bold text-slate-900">{s.thresholdLabel}</h4>

      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        <bdi className="font-semibold text-slate-700">{stage.meter}%</bdi>
        <span aria-hidden="true"> × </span>
        <bdi className="font-semibold text-slate-700">{stage.participants}</bdi>{" "}
        {s.participantsLabel}
        <span aria-hidden="true"> = </span>
        <bdi className="font-semibold text-slate-700">{stage.threshold}</bdi> {s.supporters}
      </p>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-[11px] leading-tight text-slate-500">
          <bdi
            className={`block text-base font-bold tabular-nums ${
              stage.passed ? "text-emerald-700" : "text-slate-800"
            }`}
          >
            {Math.max(0, stage.gap)}
          </bdi>
          {s.gapLabel}
        </span>
        <span className="text-end text-[11px] leading-tight text-slate-500">
          <bdi className="block text-base font-bold tabular-nums text-slate-800">
            {stage.threshold}
          </bdi>
          {s.supporters}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={stage.threshold}
        aria-valuenow={Math.min(stage.threshold, Math.max(0, stage.gap))}
        className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            stage.passed ? "bg-emerald-500" : "bg-blue-500"
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <div
        role="status"
        className={`mt-3 flex gap-2 rounded-lg border p-2.5 ${
          stage.passed
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        {stage.passed ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        )}
        <div>
          <p
            className={`text-xs font-bold ${
              stage.passed ? "text-emerald-900" : "text-amber-900"
            }`}
          >
            {stage.passed ? s.passedLabel : s.failedLabel}
          </p>
          <p
            className={`mt-0.5 text-[11px] leading-relaxed ${
              stage.passed ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            {stage.passed
              ? fill(s.passNote, { next: stage.nextThreshold, prev: stage.threshold })
              : stage.remaining <= 1
                ? s.remainingOne
                : fill(s.remainingMany, { n: stage.remaining })}
          </p>
        </div>
      </div>
    </section>
  );
}