import { RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";

export default function VoteButtons({
  proLabel,
  conLabel,
  step,
  onPro,
  onCon,
  disabled,
  resetLabel,
  onReset,
}) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPro}
          disabled={disabled}
          className={`${base} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`}
        >
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          {proLabel}
          <bdi className="rounded-full bg-white/20 px-1.5 text-xs tabular-nums">+{step}</bdi>
        </button>

        <button
          type="button"
          onClick={onCon}
          disabled={disabled}
          className={`${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
          {conLabel}
          <bdi className="rounded-full bg-slate-100 px-1.5 text-xs tabular-nums text-slate-600">
            +{step}
          </bdi>
        </button>
      </div>

      <div className="mt-2 flex items-center justify-end">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          {resetLabel}
        </button>
      </div>
    </div>
  );
}