/**
 * Where the document sits between "easy to change" and "built to last".
 * Filled from the inline start, so it reads correctly in both LTR and RTL.
 */
export default function StabilityStrip({ label, percent, startLabel, endLabel }) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <bdi className="text-xs font-bold tabular-nums text-slate-700">{clamped}%</bdi>
      </div>

      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>

      <div className="mt-1 flex justify-between gap-3 text-[11px] text-slate-500">
        <span>{startLabel}</span>
        <span className="text-end">{endLabel}</span>
      </div>
    </div>
  );
}