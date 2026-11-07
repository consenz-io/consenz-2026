import { learnMoreIcon } from "./iconMap";

export default function CapabilitiesGrid({ c }) {
  return (
    <section className="border-y border-slate-200 bg-white/60 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-14 md:py-16">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-slate-900">{c.title}</h2>
          <p className="mt-2 text-slate-600">{c.subtitle}</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {c.items.map((item) => {
            const Icon = learnMoreIcon[item.icon];
            return (
              <div
                key={item.title}
                className="flex gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}