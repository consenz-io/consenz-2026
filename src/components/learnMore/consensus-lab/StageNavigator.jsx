import { Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { fill } from "@/components/learnMore/consensus-lab/demoStages";

/**
 * The edit rail: every node is one edit the document went through, with the
 * group's size at that point underneath. The two wide buttons spell out where
 * they move to.
 */
export default function StageNavigator({ s, stages, index, onSelect }) {
  const total = stages.length;
  const atStart = index === 0;
  const atEnd = index === total - 1;
  const progress = total > 1 ? (index / (total - 1)) * 100 : 100;

  return (
    <div className="border-b border-slate-100 p-5 md:p-6">
      <span className="text-sm font-bold text-slate-800">
        {fill(s.stepLabel, { n: index + 1, total })}
      </span>

      <ol className="relative mt-4 flex items-start justify-between" aria-label={s.stepsNavLabel}>
        <span
          className="pointer-events-none absolute start-4 end-4 top-4 h-0.5 -translate-y-1/2 rounded-full bg-slate-200"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute start-4 top-4 h-0.5 -translate-y-1/2 rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `calc((100% - 2rem) * ${progress / 100})` }}
          aria-hidden="true"
        />
        {stages.map((item, stepIndex) => {
          const active = stepIndex === index;
          const done = stepIndex < index;

          return (
            <li key={item.participants} className="relative z-10 flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(stepIndex)}
                aria-current={active ? "step" : undefined}
                aria-label={`${fill(s.stepLabel, { n: stepIndex + 1, total })} — ${item.participants} ${s.participantsLabel}`}
                className={`grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold tabular-nums transition-all duration-200 ${
                  active
                    ? "scale-110 border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200"
                    : done
                      ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400"
                      : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                }`}
              >
                {done ? <Check className="h-4 w-4" aria-hidden="true" /> : stepIndex + 1}
              </button>
              <bdi
                className={`text-[10px] font-semibold tabular-nums ${
                  active ? "text-blue-700" : "text-slate-400"
                }`}
              >
                {item.participants}
              </bdi>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSelect(index - 1)}
          disabled={atStart}
          className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700"
        >
          <ChevronLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
          <span className="truncate">{s.prevLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelect(atEnd ? 0 : index + 1)}
          className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700"
        >
          <span className="truncate">{atEnd ? s.restartLabel : s.nextLabel}</span>
          {atEnd ? (
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}