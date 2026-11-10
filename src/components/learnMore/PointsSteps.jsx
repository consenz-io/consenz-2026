import { ShieldCheck, Sparkles, Users } from "lucide-react";
import PointsBalanceScale from "@/components/learnMore/PointsBalanceScale";

function StepCard({ step, index }) {
  return (
    <li className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-500 text-xs font-bold text-white">
        {index + 1}
      </span>
      <h4 className="mt-2.5 text-sm font-semibold text-slate-900">{step.title}</h4>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.text}</p>
      {step.example && (
        <p className="mt-2 rounded-md bg-blue-100/70 px-3 py-2 text-sm font-medium leading-relaxed text-blue-900">
          {step.example}
        </p>
      )}
    </li>
  );
}

export default function PointsSteps({ c }) {
  return (
    <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50/60 p-6 md:p-8">
      <h3 className="text-lg font-semibold text-slate-900">{c.logicTitle}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 md:text-base">
        {c.logicIntro}
      </p>

      <h4 className="mt-7 text-sm font-bold uppercase tracking-wide text-blue-900">
        {c.stepsTitle}
      </h4>
      <ul className="mt-3 grid gap-4 md:grid-cols-2">
        {c.steps.map((step, index) => (
          <StepCard key={step.title} step={step} index={index} />
        ))}
      </ul>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-indigo-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            <h4 className="text-sm font-bold text-slate-900">{c.uniqueTitle}</h4>
          </div>
          <ul className="mt-3 space-y-2.5">
            {c.uniquePoints.map((point) => (
              <li key={point} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" aria-hidden="true" />
            <h4 className="text-sm font-bold text-slate-900">{c.impactTitle}</h4>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{c.impactText}</p>
        </div>
      </div>

      <PointsBalanceScale s={c.spectrum} />
    </div>
  );
}