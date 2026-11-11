/**
 * The single instrument of the demo: a track whose length IS the threshold and
 * whose fill IS the current for-minus-against gap. The dashed box at the end is
 * the goal a proposal has to reach. Everything else on the card refers to this.
 */
export default function SupportRail({
  meterPercent,
  participants,
  participantsLabel,
  needed,
  supportersWord,
  current,
}) {
  const progress = needed > 0 ? Math.min(100, Math.max(0, (current / needed) * 100)) : 0;
  const close = progress >= 67;

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <bdi className="rounded bg-slate-100 px-1.5 py-0.5 font-bold tabular-nums text-slate-700">
          {meterPercent}%
        </bdi>
        <span className="text-slate-400" aria-hidden="true">×</span>
        <bdi className="rounded bg-slate-100 px-1.5 py-0.5 font-bold tabular-nums text-slate-700">
          {participants.toLocaleString()}
        </bdi>
        <span className="text-slate-500">{participantsLabel}</span>
        <span className="text-slate-400" aria-hidden="true">=</span>
        <bdi className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold tabular-nums text-emerald-700">
          {needed.toLocaleString()}
        </bdi>
        <span className="text-slate-500">{supportersWord}</span>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={needed}
          aria-valuenow={current}
          className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              close ? "bg-emerald-500" : "bg-blue-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span
          className={`grid h-7 min-w-[2.5rem] shrink-0 place-items-center rounded-lg border-2 border-dashed px-1.5 text-xs font-bold tabular-nums ${
            close
              ? "border-emerald-400 bg-emerald-50 text-emerald-700"
              : "border-slate-300 text-slate-500"
          }`}
          dir="ltr"
        >
          {needed.toLocaleString()}
        </span>
      </div>
    </div>
  );
}