import { fill, fmt } from "@/components/learnMore/consensus-lab/demoStages";
import ThresholdFlow from "@/components/learnMore/consensus-lab/ThresholdFlow";

/**
 * The threshold the document carries out of this stage — shown with the numbers
 * it came from, so the reader can check the rule: meter × participants, never
 * below 2 — and why it jumped: the group grew while the vote was open.
 */
export default function ThresholdUpdate({ s, stage }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
      <span className="text-sm font-semibold text-slate-700">
        {s.updatedThresholdLabel}
      </span>
      <ThresholdFlow s={s} stage={stage} />
      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
        {fill(s.updatedThresholdNote, {
          percent: stage.meterAfter,
          participants: fmt(stage.participants),
          next: fmt(stage.nextThreshold),
        })}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {fill(s.growthNote, {
          openedAt: fmt(stage.openedAt),
          participants: fmt(stage.participants),
          threshold: fmt(stage.threshold),
        })}
      </p>
    </div>
  );
}