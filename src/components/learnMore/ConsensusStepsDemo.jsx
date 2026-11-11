import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FilePlus2, Pencil, Trash2 } from "lucide-react";
import {
  SEQUENCE,
  fill,
  stateIndexFor,
} from "@/components/learnMore/consensus-lab/demoStages";
import StageNavigator from "@/components/learnMore/consensus-lab/StageNavigator";
import StageNarrative from "@/components/learnMore/consensus-lab/StageNarrative";
import ThresholdUpdate from "@/components/learnMore/consensus-lab/ThresholdUpdate";
import VoteSplit from "@/components/learnMore/consensus-lab/VoteSplit";
import EditStats from "@/components/learnMore/consensus-lab/EditStats";
import ConsensusTrail from "@/components/learnMore/consensus-lab/ConsensusTrail";

const TYPES = {
  new_section: { Icon: FilePlus2, tone: "bg-blue-50 text-blue-800" },
  edit_section: { Icon: Pencil, tone: "bg-indigo-50 text-indigo-800" },
  delete_section: { Icon: Trash2, tone: "bg-rose-50 text-rose-800" },
};

export default function ConsensusStepsDemo({ s }) {
  const [index, setIndex] = useState(0);

  const total = SEQUENCE.length;
  const stage = SEQUENCE[index];
  const stateIndex = stateIndexFor(stage.meterAfter);
  const { Icon, tone } = TYPES[stage.type];
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
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {s.typeLabels[stage.type]}
          </span>
          <span className="inline-flex items-baseline gap-1">
            <bdi className="text-2xl font-bold tabular-nums text-slate-900">
              {stage.participants}
            </bdi>
            <span className="text-sm font-medium text-slate-600">{s.participantsLabel}</span>
          </span>
        </div>

        <StageNarrative s={s} stage={stage} />

        <VoteSplit s={s} stage={stage} />
        <EditStats s={s} stage={stage} />

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>{s.passedLabel}</span>
          <span className="text-emerald-600" aria-hidden="true">
            ·
          </span>
          <span>{s.docNotes[stage.type]}</span>
          <span className="ms-auto inline-flex items-baseline gap-1 font-medium text-emerald-800/80">
            <bdi className="font-bold tabular-nums">{stage.sections}</bdi>
            {s.sectionsLabel}
          </span>
        </div>

        <ConsensusTrail s={s} stage={stage} stateIndex={stateIndex} />

        <ThresholdUpdate s={s} stage={stage} />
      </motion.div>

      <p className="sr-only" aria-live="polite">
        {fill(s.stepLabel, { n: index + 1, total })} — {s.typeLabels[stage.type]},{" "}
        {stage.participants} {s.participantsLabel}, {stage.pro} {s.proLabel}, {stage.con}{" "}
        {s.conLabel}, {stage.threshold} {s.supporters}, {s.levelLabel}: {stage.meter}% →{" "}
        {stage.meterAfter}%
      </p>
    </div>
  );
}