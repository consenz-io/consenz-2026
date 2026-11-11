/**
 * The three figures this edit turned on, side by side — read them once, left
 * to right: what was required, what was reached, and the score it gave the
 * section.
 */
export default function EditStats({ s, stage }) {
  const cells = [
    { label: s.thresholdLabel, value: stage.threshold, unit: s.supporters },
    { label: s.gapLabel, value: stage.gap, unit: null },
    { label: s.scoreLabel, value: `${stage.score}%`, unit: null },
  ];

  return (
    <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-100 bg-slate-50 py-2.5 rtl:divide-x-reverse">
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-0 px-2 text-center">
          <dt className="text-xs font-medium leading-tight text-slate-600">{cell.label}</dt>
          <dd className="mt-1 text-base font-bold tabular-nums text-slate-900">
            <bdi>{cell.value}</bdi>
            {cell.unit && (
              <span className="ms-1 text-xs font-medium text-slate-600">{cell.unit}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}