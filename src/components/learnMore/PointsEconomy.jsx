import { TrendingDown, TrendingUp } from "lucide-react";

function PointList({ title, items, tone, note, sign }) {
  const isCost = tone === "cost";
  const accent = isCost
    ? "bg-rose-50 text-rose-600 ring-rose-100"
    : "bg-emerald-50 text-emerald-600 ring-emerald-100";
  const badge = isCost
    ? "bg-rose-50 text-rose-700 ring-rose-200"
    : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  const Icon = isCost ? TrendingDown : TrendingUp;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${accent}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>

      <ul className="mt-5 space-y-2.5">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3.5 py-2.5"
          >
            <span className="text-sm leading-snug text-slate-700">{item.label}</span>
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ring-inset ${badge}`}
              dir="ltr"
            >
              {sign}{item.value}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

export default function PointsEconomy({ c }) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <div className="max-w-2xl">
        <h2
          className="text-2xl font-bold tracking-tight text-foreground md:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {c.title}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{c.subtitle}</p>
      </div>

      <div className="mt-9 grid gap-5 md:grid-cols-2">
        <PointList
          title={c.costsTitle}
          items={c.costs}
          tone="cost"
          note={c.costsNote}
          sign="-"
        />
        <PointList
          title={c.rewardsTitle}
          items={c.rewards}
          tone="reward"
          note={c.rewardsNote}
          sign=""
        />
      </div>
    </section>
  );
}