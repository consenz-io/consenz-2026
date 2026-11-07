import { learnMoreIcon } from "./iconMap";

export default function ValuePillars({ c }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-14 md:py-16">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold text-slate-900">{c.title}</h2>
        <p className="mt-2 text-slate-600">{c.subtitle}</p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {c.items.map((item) => {
          const Icon = learnMoreIcon[item.icon];
          return (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm transition-all hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}