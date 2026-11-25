import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fmt } from "@/components/learnMore/consensus-lab/demoStages";

const DURATION = 1.1;

/** Counts from the value in force to the new one, so the change is read as motion. */
function AnimatedNumber({ from, to }) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (reduce) {
      setValue(to);
      return;
    }
    const controls = animate(from, to, {
      duration: DURATION,
      ease: "easeInOut",
      onUpdate: (latest) => setValue(latest),
    });
    return () => controls.stop();
  }, [from, to, reduce]);

  return <>{fmt(Math.round(value))}</>;
}

/**
 * One measured row: the value in force is struck through, the new value counts
 * up, and the marker travels along the track as the bar grows to it.
 */
function Meter({ label, unit, from, to, barClass, dotClass, ringClass }) {
  const reduce = useReducedMotion();
  const scale = Math.max(from, to, 1);
  const fromWidth = `${(from / scale) * 100}%`;
  const toWidth = `${(to / scale) * 100}%`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-600">{label}</span>
        <span className="inline-flex items-baseline gap-1">
          <bdi className="text-xs font-semibold tabular-nums text-slate-400 line-through">
            {fmt(from)}
          </bdi>
          <ArrowRight className="h-3 w-3 shrink-0 text-slate-400 rtl:rotate-180" aria-hidden="true" />
          <bdi className="text-base font-bold leading-none tabular-nums text-slate-900">
            <AnimatedNumber from={from} to={to} />
          </bdi>
          {unit && <span className="text-[11px] font-medium text-slate-600">{unit}</span>}
        </span>
      </div>

      <div className="relative mt-1 h-2 rounded-full bg-slate-200/90">
        <motion.div
          className={`absolute inset-y-0 start-0 rounded-full ${barClass}`}
          initial={{ width: reduce ? toWidth : fromWidth }}
          animate={{ width: toWidth }}
          transition={{ duration: DURATION, ease: "easeInOut" }}
        >
          <span
            className={`absolute top-1/2 end-0 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-white shadow-sm rtl:-translate-x-1/2 ${dotClass}`}
            aria-hidden="true"
          />
          {!reduce && (
            <motion.span
              className={`absolute top-1/2 end-0 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full rtl:-translate-x-1/2 ${ringClass}`}
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 2.1], opacity: [0.5, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: DURATION }}
              aria-hidden="true"
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

/**
 * The threshold the next proposal opens with, shown as it takes over from the
 * one in force, next to the group growth that caused the rise.
 */
export default function ThresholdFlow({ s, stage }) {
  return (
    <div className="mt-2 space-y-2">
      <Meter
        label={s.thresholdLabel}
        unit={s.supporters}
        from={stage.threshold}
        to={stage.nextThreshold}
        barClass="bg-indigo-500"
        dotClass="bg-indigo-600"
        ringClass="bg-indigo-400"
      />
      <Meter
        label={s.participantsLabel}
        from={stage.openedAt}
        to={stage.participants}
        barClass="bg-emerald-500"
        dotClass="bg-emerald-600"
        ringClass="bg-emerald-400"
      />
    </div>
  );
}