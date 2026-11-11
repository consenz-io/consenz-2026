import { COMPARE } from "@/components/learnMore/consensus-lab/demoStages";
import ScenarioCard from "@/components/learnMore/consensus-lab/ScenarioCard";

/**
 * The same vote twice: one accepted with little opposition, one accepted with
 * many — and only the second one pulls the document's consensus meter down.
 */
export default function ScenarioCompare({ s }) {
  const c = s.compare;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">{c.label}</span>
      <h3 className="mt-1 text-base font-bold leading-tight text-slate-900 md:text-lg">{c.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 md:text-sm">{c.hint}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ScenarioCard s={s} title={c.calmTitle} scenario={COMPARE.calm} />
        <ScenarioCard s={s} title={c.splitTitle} scenario={COMPARE.split} />
      </div>

      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
        {c.takeaway}
      </p>
    </div>
  );
}