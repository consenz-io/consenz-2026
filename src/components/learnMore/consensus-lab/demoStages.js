const DEFAULT_METER = 0.5; // a document with no accepted proposal yet
const START_SECTIONS = 4;

// The group the demo starts with, before the first proposal. The first vote
// therefore opens at the floor every document starts from: 2 supporters.
const START_PARTICIPANTS = 4;

// One accepted proposal per stage, on a document that spreads at an even pace:
// a couple of hundred participants join between one stage and the next. A vote
// stays open for days while the group keeps growing, so its
// threshold is fixed at the number of participants the previous stage ended
// with — exactly the threshold the previous stage showed for this one — while
// `participants` counts the group by the time it passed. That lag is how a
// proposal passes and still pulls the meter down.
const PROPOSALS = [
  { type: "new_section", participants: 200, con: 43 },
  { type: "edit_section", participants: 400, con: 20 },
  { type: "delete_section", participants: 600, con: 40 },
  { type: "edit_section", participants: 800, con: 70 },
  { type: "new_section", participants: 1000, con: 100 },
];

const average = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;

// Participant counts run into the hundreds, so they are grouped in the UI.
export const fmt = (value) => Number(value).toLocaleString("en-US");

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
  const stages = [];
  let sections = START_SECTIONS;
  // Carried from stage to stage: the group size the previous vote ended with.
  let openedAt = START_PARTICIPANTS;

  PROPOSALS.forEach(({ type, participants, con }) => {
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

    stages.push({
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
      // The threshold the document now carries into the next proposal — the
      // exact number the next stage opens with.
      nextThreshold: thresholdFor(meterAfter, participants),
      sectionsBefore,
      sections,
    });
    openedAt = participants;
  });

  return stages;
};

export const SEQUENCE = buildStages();

export const stateIndexFor = (percent) => (percent < 34 ? 0 : percent < 67 ? 1 : 2);