import SuggestionFunnel from "@/components/learnMore/SuggestionFunnel";

const MARKER_TONES = ["bg-sky-500", "bg-emerald-600"];

export default function PointsBalanceScale({ s }) {
  return (
    <div className="mt-4 rounded-xl border-2 border-amber-300 bg-white p-4 shadow-sm md:p-5">
      <h3 className="text-sm font-bold text-slate-900">{s.title}</h3>

      <div className="mt-3">
        <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200 md:text-xs">
          {s.openLabel}
        </span>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{s.openCaption}</p>
      </div>

      <SuggestionFunnel />

      <div className="mt-1 text-center">
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 md:text-xs">
          {s.focusLabel}
        </span>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{s.focusCaption}</p>
      </div>

      <ul className="mt-4 space-y-2.5">
        {s.markers.map((marker, index) => (
          <li key={marker.label} className="flex gap-2.5">
            <span
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${MARKER_TONES[index] ?? "bg-slate-400"}`}
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900">{marker.label}: </span>
              {marker.text}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs leading-relaxed text-slate-500">{s.hint}</p>
    </div>
  );
}