import { ThumbsDown, ThumbsUp, Users } from "lucide-react";

/**
 * Who took part and how they voted, drawn with the same green/red vote
 * language the document's own voting cards use.
 */
export default function VoteSplitPanel({ s, stage }) {
  const proPercent = (stage.pro / stage.participants) * 100;
  const conPercent = (stage.con / stage.participants) * 100;
  const undecidedPercent = 100 - proPercent - conPercent;

  return (
    <section
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4"
      aria-label={s.votesTitle}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-900">{s.votesTitle}</h4>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Users className="h-3 w-3" aria-hidden="true" />
            <bdi className="font-bold tabular-nums text-slate-700">{stage.voted}</bdi>
            {s.votedLabel}
          </span>
        </div>
        <div className="text-end">
          <bdi className="block text-2xl font-bold leading-none tabular-nums text-slate-900">
            {stage.participants}
          </bdi>
          <span className="text-[11px] font-medium text-slate-500">{s.participantsLabel}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-green-200 bg-green-50 px-2 text-green-800">
          <ThumbsUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          <bdi className="text-lg font-bold leading-none tabular-nums">{stage.pro}</bdi>
          <span className="text-xs font-semibold">{s.proLabel}</span>
        </div>
        <div className="flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-red-200 bg-red-50 px-2 text-red-800">
          <ThumbsDown className="h-4 w-4 shrink-0" aria-hidden="true" />
          <bdi className="text-lg font-bold leading-none tabular-nums">{stage.con}</bdi>
          <span className="text-xs font-semibold">{s.conLabel}</span>
        </div>
      </div>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-green-500 transition-all duration-500" style={{ width: `${proPercent}%` }} />
        <div className="bg-red-500 transition-all duration-500" style={{ width: `${conPercent}%` }} />
        <div className="bg-slate-200 transition-all duration-500" style={{ width: `${undecidedPercent}%` }} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
          {s.proLabel}
          <bdi className="font-bold tabular-nums text-slate-700">{stage.pro}</bdi>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
          {s.conLabel}
          <bdi className="font-bold tabular-nums text-slate-700">{stage.con}</bdi>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
          {s.undecidedLabel}
          <bdi className="font-bold tabular-nums text-slate-700">{stage.undecided}</bdi>
        </span>
      </div>
    </section>
  );
}