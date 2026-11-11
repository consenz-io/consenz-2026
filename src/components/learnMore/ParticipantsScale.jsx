import { UserPlus } from "lucide-react";

const DOT_COLOR = "bg-sky-500";
const MAX_DOTS = 66;

export default function ParticipantsScale({ s, participants, maxParticipants, onChange }) {
  // Dot cloud grows with the circle of participants (square-root scale, so the
  // first joiners are visible and the growth stays readable at scale).
  const dotCount = Math.min(
    MAX_DOTS,
    Math.max(2, Math.round(2 + (MAX_DOTS - 2) * Math.sqrt(participants / maxParticipants)))
  );

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-blue-900">{s.participantsLabel}</span>
        <span className="text-lg font-bold tabular-nums text-blue-900" dir="ltr">
          {participants.toLocaleString()}
        </span>
      </div>

      <div className="flex max-w-[280px] flex-wrap justify-center gap-1.5 py-3 mx-auto" aria-hidden="true">
        {Array.from({ length: dotCount }).map((_, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full ${DOT_COLOR}`} />
        ))}
      </div>

      <input
        type="range"
        min="5"
        max={maxParticipants}
        step="5"
        value={participants}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={s.participantsHint}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-[10px] font-semibold text-slate-500 tabular-nums">
        <span dir="ltr">5</span>
        <span dir="ltr">{maxParticipants.toLocaleString()}</span>
      </div>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-slate-600">
        <UserPlus className="h-3 w-3" aria-hidden="true" />
        {s.joinNote}
      </p>
    </div>
  );
}