import { useState } from "react";
import { motion } from "framer-motion";
import { Footprints } from "lucide-react";
import {
  SEQUENCE,
  fill,
  stateIndexFor,
} from "@/components/learnMore/consensus-lab/demoStages";
import StageNavigator from "@/components/learnMore/consensus-lab/StageNavigator";
import VoteSplitPanel from "@/components/learnMore/consensus-lab/VoteSplitPanel";
import ThresholdPanel from "@/components/learnMore/consensus-lab/ThresholdPanel";
import StabilityPanel from "@/components/learnMore/consensus-lab/StabilityPanel";

export default function ConsensusStepsDemo({ s }) {
  const [index, setIndex] = useState(0);

  const total = SEQUENCE.length;
  const stage = SEQUENCE[index];
  const shownMeter = stage.passed ? stage.meterAfter : stage.meter;
  const stateIndex = stateIndexFor(shownMeter);
  const goTo = (next) => setIndex(Math.min(total - 1, Math.max(0, next)));

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-br from-blue-50/80 to-white p-5 md:p-6">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm"
          aria-hidden="true"
        >
          <Footprints className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            {s.simulatorLabel}
          </span>
          <h3 className="text-base font-bold leading-tight text-slate-900 md:text-lg">{s.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 md:text-sm">{s.hint}</p>
        </div>
      </div>

      <StageNavigator s={s} stages={SEQUENCE} index={index} onSelect={goTo} />

      <motion.div
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="p-5 md:p-6"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <VoteSplitPanel s={s} stage={stage} />
          <ThresholdPanel s={s} stage={stage} />
        </div>

        <StabilityPanel s={s} percent={shownMeter} stateIndex={stateIndex} />
      </motion.div>

      <p className="sr-only" aria-live="polite">
        {fill(s.stepLabel, { n: index + 1, total })} — {stage.participants}{" "}
        {s.participantsLabel}, {stage.pro} {s.proLabel}, {stage.con} {s.conLabel},{" "}
        {stage.threshold} {s.supporters}
      </p>
    </div>
  );
}