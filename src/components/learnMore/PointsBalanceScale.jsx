import SuggestionFunnel from "@/components/learnMore/SuggestionFunnel";

export default function PointsBalanceScale({ s }) {
  return (
    <div className="mt-4 rounded-lg border border-amber-300 bg-white p-3.5">
      <h5 className="text-xs font-bold text-slate-900">{s.title}</h5>

      <div className="mt-2.5 flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200">
          {s.openLabel}
        </span>
        <p className="text-[11px] leading-relaxed text-slate-600">{s.openCaption}</p>
      </div>

      <SuggestionFunnel />

      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
          {s.focusLabel}
        </span>
        <p className="text-[11px] leading-relaxed text-slate-600">{s.focusCaption}</p>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{s.hint}</p>
    </div>
  );
}