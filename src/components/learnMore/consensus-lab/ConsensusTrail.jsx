import { motion, useReducedMotion } from "framer-motion";

const TONES = [
  "bg-amber-50 text-amber-800",
  "bg-sky-50 text-sky-800",
  "bg-emerald-50 text-emerald-800",
];

/**
 * The dial the document moves along after this edit: the marker slides from
 * where the meter stood to where it now stands, so the change reads as movement
 * rather than a dot that appears in a new place. The number itself sits in the
 * stats card, next to the threshold.
 */
export default function ConsensusTrail({ s, stage, stateIndex }) {
  const reducedMotion = useReducedMotion();
  const from = Math.min(100, Math.max(0, stage.meter));
  const to = Math.min(100, Math.max(0, stage.meterAfter));
  const dropped = stage.trend === "down";

  return (
    <div>
      <div className="relative mt-1 h-2.5 rounded-full bg-gradient-to-r from-amber-200 via-sky-200 to-emerald-300 rtl:bg-gradient-to-l">
        <motion.span
          className="absolute inset-y-0 w-0"
          initial={{ insetInlineStart: `${from}%` }}
          animate={{ insetInlineStart: `${to}%` }}
          transition={{ duration: reducedMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow rtl:translate-x-1/2"
            style={{ backgroundColor: dropped ? "#e11d48" : "#0f172a" }}
          />
        </motion.span>
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