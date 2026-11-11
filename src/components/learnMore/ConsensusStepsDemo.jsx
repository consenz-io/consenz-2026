import { useState } from "react";
import { ChevronLeft, ChevronRight, Footprints } from "lucide-react";
import SupportRail from "@/components/learnMore/lab/SupportRail";
import StabilityStrip from "@/components/learnMore/lab/StabilityStrip";

const DEFAULT_METER = 0.5; // a document with no accepted proposal yet

// A fixed illustration: the group grows from stage to stage, and each stage
// has its own vote split. The numbers never change, so stepping back and
// forth always shows the same figures.
const STAGES = [
  { participants: 8, pro: 4, con: 2 },
  { participants: 16, pro: 9, con: 4 },
  { participants: 30, pro: 21, con: 5 },
  { participants: 55, pro: 28, con: 16 },
  { participants: 90, pro: 52, con: 21 },
  { participants: 140, pro: 121, con: 7 },
];

const average = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;

const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template || "",
  );

/**
 * Every figure on the card comes from the stage's own vote split:
 * the consensus meter sets the threshold, the gap between for and against
 * is measured against it, and an accepted proposal feeds the meter again.
 */
const buildStages = () => {
  const accepted = [];

  return STAGES.map((stage, index) => {
    const { participants, pro, con } = stage;
    const meter = accepted.length ? average(accepted) : DEFAULT_METER;
    const voted = pro + con;
    const gap = pro - con;
    const threshold = Math.max(
      2,
      Math.min(Math.round(meter * participants), Math.max(2, voted)),
    );
    const passed = gap >= threshold;

    if (passed) {
      accepted.push(Math.min(1, Math.max(0, (gap + participants) / (2 * participants))));
    }

    const meterAfter = accepted.length ? average(accepted) : meter;
    const previous = index > 0 ? STAGES[index - 1].participants : null;

    return {
      participants,
      pro,
      con,
      voted,
      undecided: participants - pro - con,
      gap,
      threshold,
      passed,
      meter: Math.round(meter * 100),
      meterAfter: Math.round(meterAfter * 100),
      remaining: Math.max(0, threshold - gap),
      nextThreshold: Math.max(
        2,
        Math.min(Math.round(meterAfter * participants), Math.max(2, voted)),
      ),
      growth: previous === null ? null : participants - previous,
    };
  });
};

const SEQUENCE = buildStages();

export default function ConsensusStepsDemo({ s }) {
  const [index, setIndex] = useState(0);

  const total = SEQUENCE.length;
  const stage = SEQUENCE[index];
  const shownMeter = stage.passed ? stage.meterAfter : stage.meter;
  const stateIndex = shownMeter < 34 ? 0 : shownMeter < 67 ? 1 : 2;
  const proPercent = (stage.pro / stage.participants) * 100;
  const conPercent = (stage.con / stage.participants) * 100;
  const undecidedPercent = 100 - proPercent - conPercent;

  const goTo = (next) => setIndex(Math.min(total - 1, Math.max(0, next)));

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white"
          aria-hidden="true"
        >
          <Footprints className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            {s.simulatorLabel}
          </span>
          <h3 className="text-base font-bold leading-tight text-slate-900 md:text-lg">
            {s.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 md:text-sm">{s.hint}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label={s.prevLabel}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>

          <div className="flex flex-1 items-center justify-center gap-1.5">
            {SEQUENCE.map((item, stepIndex) => (
              <button
                key={item.participants}
                type="button"
                onClick={() => goTo(stepIndex)}
                aria-label={fill(s.stepLabel, { n: stepIndex + 1, total })}
                aria-current={stepIndex === index ? "step" : undefined}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  stepIndex === index
                    ? "w-7 bg-blue-600"
                    : "w-2.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index === total - 1}
            aria-label={s.nextLabel}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
          <span className="font-semibold text-slate-700">
            {fill(s.stepLabel, { n: index + 1, total })}
          </span>
          {stage.growth !== null && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
              {fill(s.growthNote, { n: stage.growth })}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <bdi className="block text-2xl font-bold tabular-nums leading-none text-slate-900">
              {stage.participants.toLocaleString()}
            </bdi>
            <span className="text-xs font-medium text-slate-500">{s.participantsLabel}</span>
          </div>
          <div className="text-end text-xs leading-relaxed text-slate-600">
            <span className="block">
              <bdi className="font-bold tabular-nums text-slate-800">{stage.voted}</bdi>{" "}
              {s.votedLabel}
            </span>
            <span className="block">
              <bdi className="font-bold tabular-nums text-slate-800">{stage.undecided}</bdi>{" "}
              {s.undecidedLabel}
            </span>
          </div>
        </div>

        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="bg-emerald-500" style={{ width: `${proPercent}%` }} />
          <div className="bg-rose-400" style={{ width: `${conPercent}%` }} />
          <div className="bg-slate-200" style={{ width: `${undecidedPercent}%` }} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="text-slate-500">{s.proLabel}</span>
            <bdi className="font-bold tabular-nums text-slate-800">{stage.pro}</bdi>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />
            <span className="text-slate-500">{s.conLabel}</span>
            <bdi className="font-bold tabular-nums text-slate-800">{stage.con}</bdi>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
            <span className="text-slate-500">{s.undecidedLabel}</span>
            <bdi className="font-bold tabular-nums text-slate-800">{stage.undecided}</bdi>
          </span>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-sm font-semibold text-slate-800">{s.thresholdLabel}</p>
        <SupportRail
          meterPercent={stage.meter}
          participants={stage.participants}
          participantsLabel={s.participantsLabel}
          needed={stage.threshold}
          supportersWord={s.supporters}
          current={Math.max(0, stage.gap)}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{s.thresholdNote}</p>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        {stage.passed ? (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold leading-relaxed text-emerald-800"
          >
            {fill(s.passNote, { next: stage.nextThreshold, prev: stage.threshold })}
          </p>
        ) : (
          <div role="status" className="rounded-lg bg-amber-50 px-3 py-2">
            <p className="text-xs font-bold text-amber-900">{s.failedLabel}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
              {stage.remaining <= 1 ? s.remainingOne : fill(s.remainingMany, { n: stage.remaining })}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <StabilityStrip
          label={s.levelLabel}
          percent={shownMeter}
          startLabel={s.dynamicPole}
          endLabel={s.stablePole}
        />
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{s.states[stateIndex]}</p>
      </div>
    </div>
  );
}