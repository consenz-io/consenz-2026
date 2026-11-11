import { CheckCircle2, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";

export default function ConsensusVoteMeter({
  s,
  participants,
  meter,
  threshold,
  votes,
  accepted,
  onVote,
  onReset,
}) {
  const meterPercent = Math.round(meter * 100);
  const gap = votes.pro - votes.con;
  const progress = Math.min(100, Math.max(0, (gap / threshold) * 100));
  const allVoted = votes.pro + votes.con >= participants;

  return (
    <div className="mt-3 space-y-3">
      {/* Document consensus meter */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-slate-700">{s.meterLabel}</span>
          <span className="text-sm font-bold tabular-nums text-blue-800" dir="ltr">
            {meterPercent}%
          </span>
        </div>
        <div dir="ltr" className="relative mt-2 h-3 rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-500">
          <span
            className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-slate-900 shadow-md"
            style={{ left: `${meterPercent}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex justify-between gap-3 text-[11px] font-semibold">
          <span className="text-blue-700">{s.dynamicPole}</span>
          <span className="text-end text-emerald-700">{s.stablePole}</span>
        </div>
        {accepted.length === 0 && <p className="mt-1 text-[11px] text-slate-500">{s.meterEmpty}</p>}
      </div>

      {/* Threshold = consensus meter x participants */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
        <p className="text-xs font-bold text-emerald-900">{s.thresholdLabel}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-bold tabular-nums" dir="ltr">
          <span className="text-blue-700">{meterPercent}%</span>
          <span className="text-slate-400">×</span>
          <span className="text-slate-700">{participants.toLocaleString()}</span>
          <span className="text-slate-400">=</span>
          <span className="text-emerald-700">{threshold.toLocaleString()}</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/80">{s.thresholdNote}</p>
      </div>

      {/* Current proposal being voted on */}
      <div className="rounded-lg border border-blue-200 bg-white px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800">{s.proposalTitle}</p>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            {s.resetLabel}
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onVote("pro")}
            disabled={allVoted}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-2 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            {s.proLabel}
            <span className="tabular-nums" dir="ltr">{votes.pro}</span>
          </button>
          <button
            type="button"
            onClick={() => onVote("con")}
            disabled={allVoted}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-slate-300 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
            {s.conLabel}
            <span className="tabular-nums" dir="ltr">{votes.con}</span>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-600">
          <span>
            {s.gapLabel}: <span className="tabular-nums text-slate-900" dir="ltr">{gap}</span>
          </span>
          <span>
            {s.neededLabel}: <span className="tabular-nums text-emerald-700" dir="ltr">{threshold}</span>
          </span>
        </div>
        <div dir="ltr" className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {allVoted && <p className="mt-2 text-[11px] font-semibold text-slate-500">{s.allVoted}</p>}
      </div>

      {/* Accepted proposals — each one moves the meter and the threshold */}
      {accepted.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] font-bold text-blue-900">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {s.acceptedLabel}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" dir="ltr">
            {accepted.map((score, i) => (
              <span
                key={i}
                className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-blue-800 shadow-sm"
              >
                {Math.round(score * 100)}%
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-blue-900/80">{s.acceptNote}</p>
        </div>
      )}
    </div>
  );
}