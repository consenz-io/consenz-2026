export default function GroupSizeControl({ label, value, max, hint, caption, onChange }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="consensus-lab-group" className="text-sm font-semibold text-slate-800">
          {label}
        </label>
        <bdi className="text-xl font-bold tabular-nums text-blue-700">{value.toLocaleString()}</bdi>
      </div>

      <input
        id="consensus-lab-group"
        type="range"
        min="5"
        max={max}
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={hint}
        aria-valuetext={value.toLocaleString()}
        className="mt-2 w-full cursor-pointer accent-blue-600"
      />

      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{caption}</p>
    </div>
  );
}