import { TrendingDown, TrendingUp } from "lucide-react";

export default function PointsTable({ title, items, tone, note, sign }) {
  const isCost = tone === "cost";
  const accent = isCost
    ? "bg-rose-50 text-rose-600"
    : "bg-emerald-50 text-emerald-600";
  const badge = isCost
    ? "bg-rose-50 text-rose-700 border border-rose-200"
    : "bg-emerald-50 text-emerald-700 border border-emerald-200";
  const Icon = isCost ? TrendingDown : TrendingUp;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5"
          >
            <span className="text-sm leading-snug text-slate-700">{item.label}</span>
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${badge}`}
              dir="ltr"
            >
              {sign}{item.value}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}