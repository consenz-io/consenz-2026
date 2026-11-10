import PointsSteps from "@/components/learnMore/PointsSteps";
import PointsTable from "@/components/learnMore/PointsTable";

export default function PointsEconomy({ c }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-14 md:py-16">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold text-slate-900">{c.title}</h2>
        <p className="mt-2 text-slate-600">{c.subtitle}</p>
      </div>

      <PointsSteps c={c} />

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <PointsTable
          title={c.costsTitle}
          items={c.costs}
          tone="cost"
          note={c.costsNote}
          sign="-"
        />
        <PointsTable
          title={c.rewardsTitle}
          items={c.rewards}
          tone="reward"
          note={c.rewardsNote}
          sign=""
        />
      </div>

      <p className="mt-6 rounded-xl border border-slate-200 bg-white/70 p-5 text-sm font-medium leading-relaxed text-slate-800 shadow-sm md:text-base">
        {c.closing}
      </p>
    </section>
  );
}