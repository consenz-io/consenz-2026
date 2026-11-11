const DEFAULT_METER = 0.5; // a document with no accepted proposal yet
const START_SECTIONS = 4;

// One accepted proposal per stage: the group as it stood, the opposition it
// met, and what kind of proposal it was. Support is derived, never typed by
// hand: a proposal passes the moment (for − against) reaches the threshold,
// so the gap lands exactly on the threshold — never above it.
const PROPOSALS = [
  { type: "new_section", participants: 8, con: 1 },
  { type: "edit_section", participants: 16, con: 1 },
  { type: "delete_section", participants: 30, con: 2 },
  { type: "edit_section", participants: 55, con: 4 },
  { type: "new_section", participants: 90, con: 5 },
  { type: "delete_section", participants: 140, con: 6 },
];

const average = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;

export const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template || "",
  );

// The platform's own numbers (see computeConsensusUpdate):
//   threshold = round(consensus meter × participants), never below 2
//   score     = (gap + participants) / (2 × participants)
//   meter     = average of the scores of all accepted proposals
const thresholdFor = (meter, participants) =>
  Math.max(2, Math.round(meter * participants));

const buildStages = () => {
  const accepted = [];
  let sections = START_SECTIONS;

  return PROPOSALS.map(({ type, participants, con }) => {
    const meter = accepted.length ? average(accepted) : DEFAULT_METER;
    const threshold = thresholdFor(meter, participants);

    // The vote that pushed it over — the acceptance vote included.
    const pro = threshold + con;
    const gap = pro - con;
    const score = Math.min(1, Math.max(0, (gap + participants) / (2 * participants)));

    accepted.push(score);
    const meterAfter = average(accepted);
    sections += type === "new_section" ? 1 : type === "delete_section" ? -1 : 0;

    const meterPercent = Math.round(meter * 100);
    const afterPercent = Math.round(meterAfter * 100);

    return {
      type,
      participants,
      pro,
      con,
      voters: pro + con,
      undecided: participants - pro - con,
      gap,
      threshold,
      score: Math.round(score * 100),
      meter: meterPercent,
      meterAfter: afterPercent,
      change: afterPercent - meterPercent,
      nextThreshold: thresholdFor(meterAfter, participants),
      sections,
    };
  });
};

export const SEQUENCE = buildStages();

export const stateIndexFor = (percent) => (percent < 34 ? 0 : percent < 67 ? 1 : 2);

// Two votes on the very same document, at the same moment: 60 participants,
// a consensus meter already at 80%, and a threshold of 15 still in force from
// an earlier vote held when the document was smaller. The two differ only in
// how the group voted — and that is what decides which way the meter moves.
const HISTORY = [0.8];
const COMPARE_BASE = { participants: 60, threshold: 15 };

const buildScenario = ({ pro, con }) => {
  const { participants, threshold } = COMPARE_BASE;
  const gap = pro - con;
  const score = Math.min(1, Math.max(0, (gap + participants) / (2 * participants)));
  const meterBefore = average(HISTORY);
  const meterAfter = average([...HISTORY, score]);

  return {
    participants,
    threshold,
    pro,
    con,
    voters: pro + con,
    gap,
    score: Math.round(score * 100),
    meterBefore: Math.round(meterBefore * 100),
    meterAfter: Math.round(meterAfter * 100),
    change: Math.round(meterAfter * 100) - Math.round(meterBefore * 100),
  };
};

export const COMPARE = {
  ...COMPARE_BASE,
  calm: buildScenario({ pro: 45, con: 3 }),
  split: buildScenario({ pro: 33, con: 18 }),
};