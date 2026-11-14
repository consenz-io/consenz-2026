import { ThumbsDown, ThumbsUp } from "lucide-react";

/**
 * The vote on this proposal as two large counts — the numbers carry the
 * meaning and the colour only supports them, so the split reads at a glance.
 */
export default function VoteSplit({ s, stage }) {
  const proPercent = (stage.pro / stage.participants) * 100;
  const conPercent = (stage.con / stage.participants) * 100;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
            <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <bdi className="block text-2xl font-bold leading-none tabular-nums text-emerald-900">
              {stage.pro}
            </bdi>
            <span className="mt-1 block text-sm font-semibold leading-none text-emerald-800">
              {s.proLabel}
            </span>
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-3 rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-600 text-white">
            <ThumbsDown className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <bdi className="block text-2xl font-bold leading-none tabular-nums text-rose-900">
              {stage.con}
            </bdi>
            <span className="mt-1 block text-sm font-semibold leading-none text-rose-800">
              {s.conLabel}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex h-3.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div
          className="bg-emerald-500 transition-all duration-500"
          style={{ width: `${proPercent}%` }}
        />
        <div
          className="bg-rose-500 transition-all duration-500"
          style={{ width: `${conPercent}%` }}
        />
      </div>

      <p className="mt-2 text-sm font-medium text-slate-600">
        <bdi className="font-bold tabular-nums text-slate-800">{stage.undecided}</bdi>{" "}
        {s.undecidedLabel}
      </p>
    </div>
  );
}