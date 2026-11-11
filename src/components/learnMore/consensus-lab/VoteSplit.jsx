/**
 * One bar for the vote of this edit, and one line of numbers under it.
 * The bar's remaining track is the part of the group that did not vote.
 */
export default function VoteSplit({ s, stage }) {
  const proPercent = (stage.pro / stage.participants) * 100;
  const conPercent = (stage.con / stage.participants) * 100;

  return (
    <div className="mt-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div
          className="bg-green-500 transition-all duration-500"
          style={{ width: `${proPercent}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-500"
          style={{ width: `${conPercent}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold text-green-700">
          <bdi className="font-bold tabular-nums">{stage.pro}</bdi> {s.proLabel}
        </span>
        <span className="font-semibold text-red-700">
          <bdi className="font-bold tabular-nums">{stage.con}</bdi> {s.conLabel}
        </span>
        <span className="text-slate-500">
          <bdi className="font-semibold tabular-nums">{stage.undecided}</bdi> {s.undecidedLabel}
        </span>
      </div>
    </div>
  );
}