import {
  Check,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { fill } from "@/components/learnMore/consensus-lab/demoStages";

const ICONS = { new_section: FilePlus2, edit_section: Pencil, delete_section: Trash2 };

/**
 * The document's story as a timeline: every accepted proposal is one moment on
 * it, in order, with the group's size and the margin it passed by underneath.
 */
export default function StoryTimeline({ s, stages, index, onSelect }) {
  const total = stages.length;
  const atStart = index === 0;
  const atEnd = index === total - 1;

  return (
    <div className="border-b border-slate-100 p-5 md:p-6">
      <span className="text-sm font-bold text-slate-800">{s.timelineLabel}</span>

      <ol className="mt-3" aria-label={s.stepsNavLabel}>
        {stages.map((item, stepIndex) => {
          const active = stepIndex === index;
          const done = stepIndex < index;
          const last = stepIndex === total - 1;
          const Icon = ICONS[item.type];

          return (
            <li key={stepIndex} className="flex gap-3">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onSelect(stepIndex)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${fill(s.stepLabel, { n: stepIndex + 1, total })} — ${s.typeLabels[item.type]}`}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold tabular-nums transition-all duration-200 ${
                    active
                      ? "scale-110 border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200"
                      : done
                        ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400"
                        : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : stepIndex + 1}
                </button>
                {!last && (
                  <span
                    className={`w-0.5 flex-1 rounded-full ${done ? "bg-blue-200" : "bg-slate-200"}`}
                    aria-hidden="true"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => onSelect(stepIndex)}
                className={`mb-2 flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-start transition-colors ${
                  active
                    ? "border-blue-300 bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? "text-blue-700" : "text-slate-400"}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-semibold ${active ? "text-blue-900" : "text-slate-700"}`}
                  >
                    {s.typeLabels[item.type]}
                  </span>
                  <span className="block truncate text-[11px] font-medium text-slate-500">
                    <bdi className="tabular-nums">{item.participants}</bdi> {s.participantsLabel}
                    {" · "}
                    {s.gapLabel}: <bdi className="tabular-nums">{item.gap}</bdi>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-1 grid grid-cols-2 gap-2">
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