import React from "react";
import ParticipantsScale from "@/components/learnMore/ParticipantsScale";
import ConsensusVoteMeter from "@/components/learnMore/ConsensusVoteMeter";

const MAX_PARTICIPANTS = 3000;
const START_PARTICIPANTS = 8;
const DEFAULT_METER = 0.5; // a document with no accepted proposal yet

export default function ConsensusStabilityScale({ s }) {
  const [participants, setParticipants] = React.useState(START_PARTICIPANTS);
  const [votes, setVotes] = React.useState({ pro: 0, con: 0 });
  const [accepted, setAccepted] = React.useState([]); // consensus score of each accepted proposal

  const meter = accepted.length
    ? accepted.reduce((sum, score) => sum + score, 0) / accepted.length
    : DEFAULT_METER;
  const threshold = Math.max(2, Math.round(meter * participants));
  const stateIndex = meter < 0.34 ? 0 : meter < 0.67 ? 1 : 2;

  const changeParticipants = (next) => {
    setParticipants(next);
    setVotes({ pro: 0, con: 0 }); // a different circle votes on a fresh proposal
  };

  const castVote = (direction) => {
    if (votes.pro + votes.con >= participants) return;
    const nextVotes = {
      pro: votes.pro + (direction === "pro" ? 1 : 0),
      con: votes.con + (direction === "con" ? 1 : 0),
    };
    const gap = nextVotes.pro - nextVotes.con;

    if (gap >= threshold) {
      // Accepted: its consensus score joins the document's consensus meter,
      // which immediately recalibrates the threshold for the next proposal.
      const score = Math.min(1, Math.max(0, (gap + participants) / (2 * participants)));
      setAccepted([...accepted, score]);
      setVotes({ pro: 0, con: 0 });
    } else {
      setVotes(nextVotes);
    }
  };

  return (
    <div className="mt-4 rounded-xl border-2 border-blue-300 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-blue-900">{s.title}</h3>
        <span
          className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold tabular-nums text-white"
          dir="ltr"
        >
          {Math.round(meter * 100)}%
        </span>
      </div>

      <img
        src="https://media.base44.com/images/public/69ef99e5583af6a64ca3772e/0ccc64b20_generated_f34be47d.png"
        alt={s.joinNote}
        className="mt-3 aspect-[16/7] w-full rounded-lg border border-blue-100 bg-slate-50 object-cover"
        loading="lazy"
      />

      <ParticipantsScale
        s={s}
        participants={participants}
        maxParticipants={MAX_PARTICIPANTS}
        onChange={changeParticipants}
      />

      <ConsensusVoteMeter
        s={s}
        participants={participants}
        meter={meter}
        threshold={threshold}
        votes={votes}
        accepted={accepted}
        onVote={castVote}
        onReset={() => {
          setVotes({ pro: 0, con: 0 });
          setAccepted([]);
        }}
      />

      <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
        {s.states[stateIndex]}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{s.hint}</p>
    </div>
  );
}