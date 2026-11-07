import { learnMoreIcon } from "./iconMap";

export default function ValuePillars({ c }) {
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

      <div className="mt-9 grid gap-5 md:grid-cols-3">
        {c.items.map((item, index) => {
          const Icon = learnMoreIcon[item.icon];
          return (
            <div
              key={item.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg"
            >
              <span className="absolute end-5 top-4 text-5xl font-bold text-slate-100 transition-colors group-hover:text-blue-50">
                {index + 1}
              </span>
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="relative mt-5 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.text}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}