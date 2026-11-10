import React from "react";

export default function ConsensusStabilityScale({ s }) {
  const [consensus, setConsensus] = React.useState(50);
  const stateIndex = consensus < 34 ? 0 : consensus < 67 ? 1 : 2;

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

      <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
        {s.states[stateIndex]}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{s.hint}</p>
    </div>
  );
}