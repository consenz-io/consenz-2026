import { learnMoreIcon } from "./iconMap";

export default function CapabilitiesGrid({ c }) {
  return (
    <section className="border-y border-border bg-slate-50/80">
      <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <div className="max-w-2xl">
          <h2
            className="text-2xl font-bold tracking-tight text-foreground md:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {c.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{c.subtitle}</p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {c.items.map((item) => {
            const Icon = learnMoreIcon[item.icon];
            return (
              <div
                key={item.title}
                className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}