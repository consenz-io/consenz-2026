import { BookOpen, Lightbulb } from "lucide-react";
import { fill } from "@/components/learnMore/consensus-lab/demoStages";

const TONES = {
  story: "border-blue-200 bg-blue-50/70",
  warn: "border-amber-300 bg-amber-50",
  guide: "border-slate-200 bg-slate-50",
};

/**
 * The stage told as a story: the document at this point, what kind of proposal
 * it was (a new section, a reworded one, a removed one), how the vote went, and
 * what that did to the consensus meter.
 */
export const narrativeText = (s, stage) => {
  const vars = {
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
    sectionsBefore: stage.sectionsBefore,
    sections: stage.sections,
  };

  const typeStory = fill(s.narratives?.[stage.type], vars);
  const verdict = fill(
    stage.trend === "down" ? s.narrativeDropSuffix : s.narrativeRise,
    vars,
  );
  return `${typeStory} ${verdict}`.trim();
};

export default function StageNarrative({ label: labelText, text, tone = "story" }) {
  const dropped = tone === "warn";
  const guide = tone === "guide";
  const Icon = guide ? Lightbulb : BookOpen;

  return (
    <div className={`mt-4 rounded-xl border-2 px-4 py-3.5 ${TONES[tone] || TONES.story}`}>
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${
          dropped ? "text-amber-800" : guide ? "text-slate-600" : "text-blue-800"
        }`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {labelText}
      </span>
      <p
        className={`mt-1.5 leading-relaxed ${
          guide ? "text-sm text-slate-600" : "text-base text-slate-800 md:text-lg"
        }`}
      >
        {text}
      </p>
    </div>
  );
}