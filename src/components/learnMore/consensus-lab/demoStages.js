const DEFAULT_METER = 0.5; // a document with no accepted proposal yet
const START_SECTIONS = 4;

// One accepted proposal per stage. `openedAt` is how many participants the
// document had when the vote opened and its threshold was fixed — the first
// vote starts at the floor every document starts from: 2 supporters. A vote
// stays open for days while the group keeps growing, so a fixed threshold can
// lag behind the group size, which is how a proposal passes and still pulls
// the meter down.
const PROPOSALS = [
  { type: "new_section", participants: 5, openedAt: 4, con: 1 },
  { type: "edit_section", participants: 16, openedAt: 16, con: 1 },
  { type: "delete_section", participants: 26, openedAt: 26, con: 2 },
  { type: "edit_section", participants: 55, openedAt: 24, con: 13 },
  { type: "new_section", participants: 68, openedAt: 68, con: 5 },
];

const average = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;

export const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template || "",
  );

// The platform's own numbers (see computeConsensusUpdate):
//   threshold = max(2, round(consensus meter × participants)) — 2 is the floor
//   score     = (gap + participants) / (2 × participants)
//   meter     = average of the scores of all accepted proposals
const thresholdFor = (meter, participants) =>
  Math.max(2, Math.round(meter * participants));

const buildStages = () => {
  const accepted = [];
  let sections = START_SECTIONS;

  return PROPOSALS.map(({ type, participants, openedAt, con }) => {
    const meter = accepted.length ? average(accepted) : DEFAULT_METER;
    const threshold = thresholdFor(meter, openedAt);

    // The vote that pushed it over — the acceptance vote included.
    const pro = threshold + con;
    const gap = pro - con;
    const score = Math.min(1, Math.max(0, (gap + participants) / (2 * participants)));

    accepted.push(score);
    const meterAfter = average(accepted);
    const sectionsBefore = sections;
    sections += type === "new_section" ? 1 : type === "delete_section" ? -1 : 0;

    return {
      type,
      participants,
      openedAt,
      pro,
      con,
      undecided: participants - pro - con,
      gap,
      threshold,
      score: Math.round(score * 100),
      meter: Math.round(meter * 100),
      meterAfter: Math.round(meterAfter * 100),
      trend: meterAfter >= meter ? "up" : "down",
      // The threshold the document now carries into the next proposal.
      nextThreshold: thresholdFor(meterAfter, participants),
      sectionsBefore,
      sections,
    };
  });
};

export const SEQUENCE = buildStages();

export const stateIndexFor = (percent) => (percent < 34 ? 0 : percent < 67 ? 1 : 2);