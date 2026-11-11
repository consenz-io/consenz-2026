import { BookOpen } from "lucide-react";
import { fill } from "@/components/learnMore/consensus-lab/demoStages";

/**
 * The stage told as a story: who was there, how the vote went, why it passed,
 * and what that did to the consensus meter. It leads the stage — the numbers
 * below it are the evidence.
 */
export default function StageNarrative({ s, stage }) {
  const dropped = stage.trend === "down";

  const text = fill(dropped ? s.narrativeDrop : s.narrative, {
    participants: stage.participants,
    openedAt: stage.openedAt,
    pro: stage.pro,
    con: stage.con,
    undecided: stage.undecided,
    gap: stage.gap,
    threshold: stage.threshold,
    score: stage.score,
    meter: stage.meter,
    after: stage.meterAfter,
  });

  return (
    <div
      className={`mt-4 rounded-xl border-2 px-4 py-3.5 ${
        dropped ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50/70"
      }`}
    >
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${
          dropped ? "text-amber-800" : "text-blue-800"
        }`}
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {s.storyLabel}
      </span>
      <p className="mt-1.5 text-base leading-relaxed text-slate-800 md:text-lg">{text}</p>
    </div>
  );
}