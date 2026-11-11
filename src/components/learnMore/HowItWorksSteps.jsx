import { RefreshCw } from "lucide-react";
import { learnMoreIcon } from "./iconMap";

export default function HowItWorksSteps({ c }) {
  return (
    <section className="border-y border-slate-200 bg-white/60 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-14 md:py-16">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-slate-900">{c.title}</h2>
          <p className="mt-2 text-slate-600">{c.subtitle}</p>
        </div>

        <ol className="relative mt-9 space-y-4">
          <span
            className="absolute inset-y-6 start-[22px] w-px bg-gradient-to-b from-blue-200 via-indigo-200 to-transparent"
            aria-hidden="true"
          />
          {c.steps.map((step, index) => {
            const Icon = learnMoreIcon[step.icon];
            return (
              <li key={step.title} className="relative flex gap-4">
                <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-600 shadow-sm">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow">
                    {index + 1}
                  </span>
                </div>

                <div className="flex-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 md:text-[15px]">
                    {step.text}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
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

        {c.loop &&
          <div className="relative mt-4 flex gap-4">
            <span
              className="absolute -top-4 start-[22px] h-4 w-px border-s border-dashed border-indigo-300"
              aria-hidden="true"
            />
            <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-indigo-300 bg-indigo-50 text-indigo-600">
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/70 p-4">
              <h3 className="text-base font-semibold text-indigo-900">{c.loop.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-indigo-900/80">{c.loop.text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.loop.chips.map((chip) =>
                  <span key={chip} className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700">
                    {chip}
                  </span>
                )}
              </div>
            </div>
          </div>
        }
      </div>
    </section>
  );
}