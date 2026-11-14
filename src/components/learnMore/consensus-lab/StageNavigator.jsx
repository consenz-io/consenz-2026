import { Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { fill, fmt } from "@/components/learnMore/consensus-lab/demoStages";

/**
 * The edit rail: every node is one edit the document went through, with the
 * group's size at that point underneath. Rail and arrows share one row, so the
 * reader always sees where they are and where they can go without the demo
 * growing taller than the screen.
 */
export default function StageNavigator({ s, stages, index, onSelect }) {
  const total = stages.length;
  const atStart = index === 0;
  const atEnd = index === total - 1;
  const progress = total > 1 ? (index / (total - 1)) * 100 : 100;

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 md:gap-3 md:px-5">
      <button
        type="button"
        onClick={() => onSelect(index - 1)}
        disabled={atStart}
        aria-label={s.prevLabel}
        title={s.prevLabel}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-full border-2 border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700 md:px-3"
      >
        <ChevronLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
        <span className="hidden md:inline">{s.prevLabel}</span>
      </button>

      <div className="min-w-0 flex-1">
        <span className="block text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {fill(s.stepLabel, { n: index + 1, total })}
        </span>

        <ol
          className="relative mt-1.5 flex items-start justify-between"
          aria-label={s.stepsNavLabel}
        >
          <span
            className="pointer-events-none absolute start-3.5 end-3.5 top-3.5 h-0.5 -translate-y-1/2 rounded-full bg-slate-200"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute start-3.5 top-3.5 h-0.5 -translate-y-1/2 rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `calc((100% - 1.75rem) * ${progress / 100})` }}
            aria-hidden="true"
          />
          {stages.map((item, stepIndex) => {
            const active = stepIndex === index;
            const done = stepIndex < index;

            return (
              <li key={item.participants} className="relative z-10 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onSelect(stepIndex)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${fill(s.stepLabel, { n: stepIndex + 1, total })} — ${fmt(item.participants)} ${s.participantsLabel}`}
                  className={`grid h-7 w-7 place-items-center rounded-full border-2 text-[11px] font-bold tabular-nums transition-all duration-200 ${
                    active
                      ? "scale-110 border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200"
                      : done
                        ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400"
                        : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : stepIndex + 1}
                </button>
                <bdi
                  className={`mt-0.5 text-[9px] font-semibold tabular-nums ${
                    active ? "text-blue-700" : "text-slate-400"
                  }`}
                >
                  {fmt(item.participants)}
                </bdi>
              </li>
            );
          })}
        </ol>
      </div>

      <button
        type="button"
        onClick={() => onSelect(atEnd ? 0 : index + 1)}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 md:px-3.5"
      >
        <span className="truncate">{atEnd ? s.restartLabel : s.nextLabel}</span>
        {atEnd ? (
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}