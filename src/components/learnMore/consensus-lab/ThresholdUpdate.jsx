import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fill, fmt } from "@/components/learnMore/consensus-lab/demoStages";
import useAnimatedNumber from "@/components/learnMore/consensus-lab/useAnimatedNumber";

const share = (value, total) =>
  `${Math.min(100, Math.max(0, (value / total) * 100))}%`;

/**
 * The threshold the document carries out of this stage — shown with the numbers
 * it came from, so the reader can check the rule: meter × participants, never
 * below 2 — and why it jumped: the group grew while the vote was open.
 *
 * Stepping in from the previous stage, the new requirement counts up from the
 * old one and its bar extends over the old mark, so the reader sees the old
 * threshold being replaced rather than two unrelated numbers.
 */
export default function ThresholdUpdate({ s, stage }) {
  const reducedMotion = useReducedMotion();
  const threshold = useAnimatedNumber(stage.threshold, stage.nextThreshold);
  const duration = reducedMotion ? 0 : 0.9;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-slate-700">
          {s.updatedThresholdLabel}
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          {/* the requirement this stage replaces */}
          <bdi className="text-xs font-semibold tabular-nums text-slate-400 line-through">
            {fmt(stage.threshold)}
          </bdi>
          <ArrowRight
            className="h-3 w-3 shrink-0 self-center text-slate-300 rtl:rotate-180"
            aria-hidden="true"
          />
          <bdi className="text-xl font-bold tabular-nums text-indigo-800">
            {fmt(Math.round(threshold))}
          </bdi>
          <span className="text-sm font-medium text-slate-600">{s.supporters}</span>
        </span>
      </div>

      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
        <motion.span
          className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
          initial={{ width: share(stage.threshold, stage.participants) }}
          animate={{ width: share(stage.nextThreshold, stage.participants) }}
          transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
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