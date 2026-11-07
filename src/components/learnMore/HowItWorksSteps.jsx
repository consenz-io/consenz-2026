import { learnMoreIcon } from "./iconMap";

export default function HowItWorksSteps({ c }) {
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

        <ol className="relative mt-10 space-y-4 md:space-y-5">
          <span
            className="absolute inset-y-6 start-[26px] w-px bg-gradient-to-b from-blue-200 via-indigo-200 to-transparent"
            aria-hidden="true"
          />
          {c.steps.map((step, index) => {
            const Icon = learnMoreIcon[step.icon];
            return (
              <li key={step.title} className="relative flex gap-4 md:gap-6">
                <div className="relative z-10 flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600 shadow-sm">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow">
                    {index + 1}
                  </span>
                </div>

                <div className="flex-1 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
                  <h3 className="text-lg font-semibold text-foreground md:text-xl">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
                    {step.text}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {step.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-border bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}