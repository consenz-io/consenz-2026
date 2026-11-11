import React from "react";
import { UserPlus, ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

// Literal class strings only — Tailwind cannot see dynamically built names.
const DOT_COLORS = ["bg-sky-300", "bg-sky-400", "bg-blue-500", "bg-blue-700"];
const BAR_COLORS = ["bg-sky-300", "bg-sky-400", "bg-blue-500", "bg-blue-700"];

export default function ConsensusStabilityScale({ s }) {
  const { isRTL } = useLanguage();
  const [consensus, setConsensus] = React.useState(50);
  const [stageIndex, setStageIndex] = React.useState(0);

  const stages = s.stages;
  const stage = stages[stageIndex];
  const participants = stage.participants;
  const maxParticipants = stages[stages.length - 1].participants;
  const threshold = Math.max(2, Math.round((consensus / 100) * participants));
  const stateIndex = consensus < 34 ? 0 : consensus < 67 ? 1 : 2;

  // Dot cloud grows with the circle of participants (square-root scale, so the
  // first joiners are visible and the growth stays readable at scale).
  const dotCount = Math.min(60, Math.max(4, Math.round(4 + 56 * Math.sqrt(participants / maxParticipants))));
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="mt-4 rounded-xl border-2 border-blue-300 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-blue-900">{s.title}</h3>
        <span
          className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold tabular-nums text-white"
          dir="ltr"
        >
          {consensus}%
        </span>
      </div>

      <img
        src="https://media.base44.com/images/public/69ef99e5583af6a64ca3772e/0ccc64b20_generated_f34be47d.png"
        alt={s.joinNote}
        className="mt-3 aspect-[16/7] w-full rounded-lg border border-blue-100 bg-slate-50 object-cover"
        loading="lazy"
      />

      {/* Stage strip: how the circle of participants grows during the process */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stages.map((item, index) => {
          const active = index === stageIndex;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => setStageIndex(index)}
              aria-pressed={active}
              className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                active
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              <span className={`block text-[11px] font-semibold leading-tight ${active ? "text-blue-50" : "text-slate-500"}`}>
                {index + 1}
              </span>
              <span className="mt-0.5 block text-[11px] font-bold leading-tight">{item.label}</span>
              <span className={`mt-1 block text-xs font-bold tabular-nums ${active ? "text-white" : "text-blue-700"}`} dir="ltr">
                {item.participants.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Visual circle of participants */}
      <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-4">
        <div className="flex max-w-[260px] flex-wrap justify-center gap-1.5" aria-hidden="true">
          {Array.from({ length: dotCount }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${DOT_COLORS[Math.min(stageIndex, DOT_COLORS.length - 1)]}`}
            />
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-sm font-bold text-blue-900">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          <span className="tabular-nums" dir="ltr">{participants.toLocaleString()}</span>
          <span>{s.participantsLabel}</span>
        </p>
        <p className="flex items-center gap-1.5 text-center text-[11px] leading-relaxed text-slate-600">
          {s.joinNote}
          {stageIndex < stages.length - 1 && (
            <span className="inline-flex items-center gap-0.5 font-bold text-blue-700 tabular-nums" dir="ltr">
              +{(stages[stageIndex + 1].participants - participants).toLocaleString()}
              <Arrow className="h-3 w-3" aria-hidden="true" />
            </span>
          )}
        </p>
      </div>

      {/* Consensus level of the document */}
      <div dir="ltr" className="mt-5">
        <div className="relative h-3 rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-500">
          <span
            className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-slate-900 shadow-md"
            style={{ left: `${consensus}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex justify-between gap-3 text-[11px] font-semibold md:text-xs">
          <span className="text-blue-700">{s.dynamicPole}</span>
          <span className="text-end text-emerald-700">{s.stablePole}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={consensus}
          onChange={(e) => setConsensus(Number(e.target.value))}
          aria-label={s.levelLabel}
          className="mt-4 w-full accent-blue-600"
        />
      </div>

      {/* Required support threshold: consensus x participants */}
      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
        <p className="text-xs font-bold text-emerald-900">{s.thresholdLabel}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-bold tabular-nums" dir="ltr">
          <span className="text-blue-700">{consensus}%</span>
          <span className="text-slate-400">×</span>
          <span className="text-slate-700">{participants.toLocaleString()}</span>
          <span className="text-slate-400">=</span>
          <span className="text-emerald-700">{threshold.toLocaleString()}</span>
        </div>
        <div dir="ltr" className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
          <div
            className={`h-full rounded-full ${BAR_COLORS[Math.min(stageIndex, BAR_COLORS.length - 1)]}`}
            style={{ width: `${Math.min(100, (threshold / participants) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/80">{s.thresholdNote}</p>
      </div>

      <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
        {s.states[stateIndex]}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{s.hint}</p>
    </div>
  );
}