import { useState } from "react";
import { MousePointerClick } from "lucide-react";
import GroupSizeControl from "@/components/learnMore/lab/GroupSizeControl";
import SupportRail from "@/components/learnMore/lab/SupportRail";
import VoteButtons from "@/components/learnMore/lab/VoteButtons";
import StabilityStrip from "@/components/learnMore/lab/StabilityStrip";

const MAX_PARTICIPANTS = 3000;
const START_PARTICIPANTS = 8;
const DEFAULT_METER = 0.5; // a document with no accepted proposal yet

const average = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template || "",
  );

/**
 * One instrument, read top to bottom:
 * 1. who takes part → 2. what it takes to pass → 3. the vote itself.
 * Every number on the card comes from those three lines, so a click on "for"
 * visibly moves the same rail whose length the group size just changed.
 */
export default function ConsensusStabilityScale({ s }) {
  const [participants, setParticipants] = useState(START_PARTICIPANTS);
  const [votes, setVotes] = useState({ pro: 0, con: 0 });
  const [accepted, setAccepted] = useState([]);
  const [lastPass, setLastPass] = useState(null);

  const meter = accepted.length ? average(accepted) : DEFAULT_METER;
  const threshold = Math.max(2, Math.round(meter * participants));
  const stateIndex = meter < 0.34 ? 0 : meter < 0.67 ? 1 : 2;
  const meterPercent = Math.round(meter * 100);
  const gap = Math.max(0, votes.pro - votes.con);
  const remaining = Math.max(0, threshold - gap);
  const allVoted = votes.pro + votes.con >= participants;

  // One click always carries a readable share of the circle, so the demo stays
  // usable at 8 participants and at 3,000 alike.
  const step = Math.max(1, Math.round(participants / 24));

  const changeParticipants = (next) => {
    setParticipants(next);
    setVotes({ pro: 0, con: 0 }); // a different circle votes on a fresh proposal
    setLastPass(null);
  };

  const castVote = (direction) => {
    setLastPass(null);
    if (allVoted) return;

    const room = participants - votes.pro - votes.con;
    const add = Math.min(step, room);
    if (add <= 0) return;

    const nextVotes = {
      pro: votes.pro + (direction === "pro" ? add : 0),
      con: votes.con + (direction === "con" ? add : 0),
    };
    const nextGap = nextVotes.pro - nextVotes.con;

    if (nextGap < threshold) {
      setVotes(nextVotes);
      return;
    }

    // Accepted: its consensus score joins the document's meter, which
    // recalibrates the threshold for the very next proposal.
    const score = Math.min(1, Math.max(0, (nextGap + participants) / (2 * participants)));
    const nextAccepted = [...accepted, score];
    const nextMeter = average(nextAccepted);

    setAccepted(nextAccepted);
    setVotes({ pro: 0, con: 0 });
    setLastPass({ prev: threshold, next: Math.max(2, Math.round(nextMeter * participants)) });
  };

  const reset = () => {
    setVotes({ pro: 0, con: 0 });
    setAccepted([]);
    setLastPass(null);
  };

  return (
    <div
      className={`mt-5 rounded-2xl border bg-white p-5 shadow-sm md:p-6 ${
        lastPass ? "suggestion-accepted-flash border-emerald-300" : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white"
          aria-hidden="true"
        >
          <MousePointerClick className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            {s.simulatorLabel}
          </span>
          <h3 className="text-base font-bold leading-tight text-slate-900 md:text-lg">{s.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 md:text-sm">{s.hint}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <GroupSizeControl
          label={s.participantsLabel}
          value={participants}
          max={MAX_PARTICIPANTS}
          hint={s.participantsHint}
          caption={s.joinNote}
          onChange={changeParticipants}
        />
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-sm font-semibold text-slate-800">{s.thresholdLabel}</p>
        <SupportRail
          meterPercent={meterPercent}
          participants={participants}
          participantsLabel={s.participantsLabel}
          needed={threshold}
          supportersWord={s.supporters}
          current={gap}
        />
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-sm font-semibold text-slate-800">{s.proposalTitle}</p>

        {lastPass ? (
          <p
            role="status"
            className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold leading-relaxed text-emerald-800"
          >
            {fill(s.passNote, { prev: lastPass.prev, next: lastPass.next })}
          </p>
        ) : (
          <p
            aria-live="polite"
            className={`mt-2 text-xs font-semibold leading-relaxed ${
              allVoted ? "text-slate-500" : "text-slate-700"
            }`}
          >
            {allVoted
              ? s.allVoted
              : remaining <= 1
                ? s.remainingOne
                : fill(s.remainingMany, { n: remaining })}
          </p>
        )}

        <div className="mt-3">
          <VoteButtons
            proLabel={s.proLabel}
            conLabel={s.conLabel}
            step={step}
            onPro={() => castVote("pro")}
            onCon={() => castVote("con")}
            disabled={allVoted}
            resetLabel={s.resetLabel}
            onReset={reset}
          />
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        {accepted.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">{s.acceptedLabel}</span>
            {accepted.map((score, index) => (
              <bdi
                key={index}
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700"
              >
                {Math.round(score * 100)}%
              </bdi>
            ))}
          </div>
        )}

        <StabilityStrip
          label={s.levelLabel}
          percent={meterPercent}
          startLabel={s.dynamicPole}
          endLabel={s.stablePole}
        />
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{s.states[stateIndex]}</p>
      </div>
    </div>
  );
}