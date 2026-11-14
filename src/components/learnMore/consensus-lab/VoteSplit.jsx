import { ThumbsDown, ThumbsUp } from "lucide-react";

/**
 * The vote on this proposal as two large counts — the numbers carry the
 * meaning and the colour only supports them, so the split reads at a glance.
 */
export default function VoteSplit({ s, stage }) {
  const proPercent = stage.pro / stage.participants * 100;
  const conPercent = stage.con / stage.participants * 100;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <bdi className="block text-xl font-bold leading-none tabular-nums text-emerald-900">
              {stage.pro}
            </bdi>
            <span className="mt-0.5 block text-xs font-semibold leading-none text-emerald-800">
              {s.proLabel}
            </span>
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rose-600 text-white">
            <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <bdi className="block text-xl font-bold leading-none tabular-nums text-rose-900">
              {stage.con}
            </bdi>
            <span className="mt-0.5 block text-xs font-semibold leading-none text-rose-800">
              {s.conLabel}
            </span>
          </span>
        </div>
      </div>

      








      

      <p className="mt-1.5 text-xs font-medium text-slate-600">
        <bdi className="font-bold tabular-nums text-slate-800">{stage.undecided}</bdi>{" "}
        {s.undecidedLabel}
      </p>
    </div>);

}