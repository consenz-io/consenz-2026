import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import {
  SEQUENCE,
  fill,
  stateIndexFor,
} from "@/components/learnMore/consensus-lab/demoStages";
import StageNavigator from "@/components/learnMore/consensus-lab/StageNavigator";
import VoteSplit from "@/components/learnMore/consensus-lab/VoteSplit";
import EditStats from "@/components/learnMore/consensus-lab/EditStats";
import ConsensusTrail from "@/components/learnMore/consensus-lab/ConsensusTrail";

export default function ConsensusStepsDemo({ s }) {
  const [index, setIndex] = useState(0);

  const total = SEQUENCE.length;
  const stage = SEQUENCE[index];
  const stateIndex = stateIndexFor(stage.meterAfter);
  const goTo = (next) => setIndex(Math.min(total - 1, Math.max(0, next)));

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 md:p-6">
        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
          {s.simulatorLabel}
        </span>
        <h3 className="mt-1 text-base font-bold leading-tight text-slate-900 md:text-lg">
          {s.title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 md:text-sm">{s.hint}</p>
      </div>

      <StageNavigator s={s} stages={SEQUENCE} index={index} onSelect={goTo} />

      <motion.div
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="p-5 md:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {s.passedLabel}
          </span>
          <span className="inline-flex items-baseline gap-1">
            <bdi className="text-xl font-bold tabular-nums text-slate-900">
              {stage.participants}
            </bdi>
            <span className="text-xs font-medium text-slate-500">{s.participantsLabel}</span>
          </span>
        </div>

        <VoteSplit s={s} stage={stage} />
        <EditStats s={s} stage={stage} />

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {fill(s.passNote, { next: stage.nextThreshold, prev: stage.threshold })}
        </p>

        <ConsensusTrail s={s} stage={stage} stateIndex={stateIndex} />
      </motion.div>

      <p className="sr-only" aria-live="polite">
        {fill(s.stepLabel, { n: index + 1, total })} — {stage.participants}{" "}
        {s.participantsLabel}, {stage.pro} {s.proLabel}, {stage.con} {s.conLabel},{" "}
        {stage.threshold} {s.supporters}
      </p>
    </div>
  );
}