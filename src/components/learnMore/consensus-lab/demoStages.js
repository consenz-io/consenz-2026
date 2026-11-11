const DEFAULT_METER = 0.5; // a document with no accepted edit yet

// One row per edit the community approved: group size and how it voted.
// Every edit clears the threshold it faced, so the document moves forward
// from edit to edit and the consensus meter climbs with it.
const EDITS = [
  { participants: 8, pro: 5, con: 1 },
  { participants: 16, pro: 14, con: 1 },
  { participants: 30, pro: 27, con: 1 },
  { participants: 55, pro: 50, con: 2 },
  { participants: 90, pro: 83, con: 3 },
  { participants: 140, pro: 132, con: 4 },
];

const average = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;

export const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template || "",
  );

const thresholdFor = (meter, participants, voted) =>
  Math.max(2, Math.min(Math.round(meter * participants), Math.max(2, voted)));

/**
 * Each edit is measured against the document's meter as it stood before the
 * vote, scores its own consensus, and leaves the meter a little higher.
 */
const buildEdits = () => {
  const accepted = [];

  return EDITS.map(({ participants, pro, con }) => {
    const meter = accepted.length ? average(accepted) : DEFAULT_METER;
    const voted = pro + con;
    const gap = pro - con;
    const threshold = thresholdFor(meter, participants, voted);
    const score = Math.min(1, Math.max(0, (gap + participants) / (2 * participants)));

    accepted.push(score);

    const meterAfter = average(accepted);

    return {
      participants,
      pro,
      con,
      undecided: participants - pro - con,
      gap,
      threshold,
      score: Math.round(score * 100),
      meter: Math.round(meter * 100),
      meterAfter: Math.round(meterAfter * 100),
      nextThreshold: thresholdFor(meterAfter, participants, voted),
    };
  });
};

export const SEQUENCE = buildEdits();

export const stateIndexFor = (percent) => (percent < 34 ? 0 : percent < 67 ? 1 : 2);