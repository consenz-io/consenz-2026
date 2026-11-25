import ConsensusScales from "@/components/learnMore/consensus-lab/ConsensusScales";

const TONES = [
  "bg-amber-50 text-amber-800",
  "bg-sky-50 text-sky-800",
  "bg-emerald-50 text-emerald-800",
];

/**
 * Where the document stands after this edit, as a pair of scales: the beam
 * swings from the meter's previous value to its new one, with the wording's
 * position written along the two poles underneath. The number itself sits in
 * the stats card, next to the threshold.
 */
export default function ConsensusTrail({ s, stage, stateIndex }) {
  return (
    <div>
      <ConsensusScales stage={stage} />

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