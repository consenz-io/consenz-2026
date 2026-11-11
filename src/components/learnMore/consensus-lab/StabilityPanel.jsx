import { Activity, Scale, ShieldCheck } from "lucide-react";

const TONES = [
  {
    box: "border-amber-200 bg-amber-50",
    icon: "bg-amber-500",
    text: "text-amber-900",
    Icon: Activity,
  },
  {
    box: "border-sky-200 bg-sky-50",
    icon: "bg-sky-500",
    text: "text-sky-900",
    Icon: Scale,
  },
  {
    box: "border-emerald-200 bg-emerald-50",
    icon: "bg-emerald-600",
    text: "text-emerald-900",
    Icon: ShieldCheck,
  },
];

/**
 * Where the document sits between "easy to change" and "built to last",
 * plus what that position means for the next proposal.
 */
export default function StabilityPanel({ s, percent, stateIndex }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const tone = TONES[stateIndex] || TONES[1];
  const { Icon } = tone;

  return (
    <section
      className="mt-3 rounded-xl border border-slate-200 bg-white p-4"
      aria-label={s.levelLabel}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {s.levelLabel}
        </h4>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1" aria-hidden="true">
            {TONES.map((item, itemIndex) => (
              <span
                key={item.icon}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  itemIndex === stateIndex ? "w-4 bg-slate-700" : "w-1.5 bg-slate-300"
                }`}
              />
            ))}
          </span>
          <bdi className="text-sm font-bold tabular-nums text-slate-800">{clamped}%</bdi>
        </div>
      </div>

      <div className="relative mt-2.5 h-3 rounded-full bg-gradient-to-r from-amber-200 via-sky-200 to-emerald-300 rtl:bg-gradient-to-l">
        <span
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow-md transition-all duration-500 rtl:translate-x-1/2"
          style={{ insetInlineStart: `${clamped}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-slate-500">
        <span>{s.dynamicPole}</span>
        <span className="text-end">{s.stablePole}</span>
      </div>

      <div className={`mt-3 flex gap-2.5 rounded-lg border p-2.5 ${tone.box}`}>
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-white ${tone.icon}`}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className={`text-xs leading-relaxed ${tone.text}`}>{s.states[stateIndex]}</p>
      </div>
    </section>
  );
}