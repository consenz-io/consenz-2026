import { BookOpen } from "lucide-react";
import { fill } from "@/components/learnMore/consensus-lab/demoStages";

/**
 * The story of the selected stage, before any numbers: what the group decided,
 * why the proposal passed, and what the document asks for from now on.
 */
export default function NarrativeCard({ s, stage }) {
  return (
    <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 md:p-5">
      <span className="w-1 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          {s.storyLabel}
        </div>
        <p className="mt-2 text-base font-bold leading-snug text-slate-900 md:text-lg">
          {fill(s.storyHeadline, { pro: stage.pro, con: stage.con })}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 md:text-[15px]">
          {fill(s.storyBody, {
            threshold: stage.threshold,
            gap: stage.gap,
            score: stage.score,
            docNote: s.docNotes[stage.type],
          })}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          {fill(s.storyNext, { next: stage.nextThreshold, meterAfter: stage.meterAfter })}
        </p>
      </div>
    </div>
  );
}