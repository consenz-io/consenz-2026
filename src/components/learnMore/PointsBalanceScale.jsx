const MARKERS = [
  { position: 12, tone: "noise" },
  { position: 64, tone: "balance" },
];

export default function PointsBalanceScale({ s }) {
  return (
    <div className="mt-4 rounded-xl border-2 border-amber-300 bg-white p-4 shadow-sm md:p-5">
      <h3 className="text-sm font-bold text-slate-900">{s.title}</h3>

      <div dir="ltr" className="mt-5">
        <div className="relative h-3 rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-blue-500">
          <span
            className="absolute inset-y-0 rounded-full border border-emerald-500/70 bg-emerald-400/25"
            style={{ left: "52%", width: "24%" }}
            aria-hidden="true"
          />
          {MARKERS.map((marker) => (
            <span
              key={marker.tone}
              className={`absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white shadow-md ${
                marker.tone === "noise" ? "bg-rose-500" : "bg-emerald-600"
              }`}
              style={{ left: `${marker.position}%` }}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between gap-3 text-[11px] font-semibold md:text-xs">
          <span className="text-rose-600">{s.noisePole}</span>
          <span className="text-end text-blue-700">{s.freedomPole}</span>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {s.markers.map((marker, index) => (
          <li key={marker.label} className="flex gap-2.5">
            <span
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                MARKERS[index]?.tone === "noise" ? "bg-rose-500" : "bg-emerald-600"
              }`}
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