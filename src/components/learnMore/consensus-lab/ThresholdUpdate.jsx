import { fill } from "@/components/learnMore/consensus-lab/demoStages";

/**
 * The threshold the document carries out of this stage — shown with the numbers
 * it came from, so the reader can check the rule: meter × participants, never
 * below 2.
 */
export default function ThresholdUpdate({ s, stage }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-slate-700">
          {s.updatedThresholdLabel}
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          <bdi className="text-xl font-bold tabular-nums text-slate-900">
            {stage.nextThreshold}
          </bdi>
          <span className="text-sm font-medium text-slate-600">{s.supporters}</span>
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        {fill(s.updatedThresholdNote, {
          percent: stage.meterAfter,
          participants: stage.participants,
          next: stage.nextThreshold,
        })}
      </p>
    </div>
  );
}