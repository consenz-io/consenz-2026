import { ArrowLeft, ArrowRight } from "lucide-react";
import { learnMoreIcon } from "./iconMap";
import { useLanguage } from "@/components/LanguageContext";

export default function ValuePillars({ c }) {
  const { isRTL } = useLanguage();
  const Chevron = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="mx-auto max-w-7xl px-6 py-14 md:py-16">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold text-slate-900">{c.title}</h2>
        <p className="mt-2 text-slate-600">{c.subtitle}</p>
      </div>

      {c.flow &&
      <ol className="mt-6 flex flex-wrap items-center gap-1.5">
        {c.flow.map((stage, index) =>
        <li key={stage} className="flex items-center gap-1.5">
            {index > 0 && <Chevron className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />}
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900 md:text-sm">
              {stage}
            </span>
          </li>
        )}
      </ol>
      }

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        {c.items.map((item) => {
          const Icon = learnMoreIcon[item.icon];
          return (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all hover:border-blue-300 hover:shadow-md">
              
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              {item.stat &&
              <span className="mt-4 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {item.stat}
                </span>
              }
            </div>);

        })}
      </div>

      {c.closing &&
      <p className="mt-6 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-sm font-medium text-blue-900">
          {c.closing}
        </p>
      }
    </section>);

}