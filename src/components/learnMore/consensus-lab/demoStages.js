const DEFAULT_METER = 0.5; // a document with no accepted proposal yet

// A fixed illustration: the group grows from stage to stage, and each stage
// has its own vote split. The numbers never change, so stepping back and
// forth always shows the same figures.
const STAGES = [
  { participants: 8, pro: 4, con: 2 },
  { participants: 16, pro: 9, con: 4 },
  { participants: 30, pro: 21, con: 5 },
  { participants: 55, pro: 28, con: 16 },
  { participants: 90, pro: 52, con: 21 },
  { participants: 140, pro: 121, con: 7 },
];

const average = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;

export const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template || "",
  );

/**
 * Every figure in a stage comes from that stage's own vote split:
 * the consensus meter sets the threshold, the gap between for and against
 * is measured against it, and an accepted proposal feeds the meter again.
 */
const buildStages = () => {
  const accepted = [];

  return STAGES.map((stage, index) => {
    const { participants, pro, con } = stage;
    const meter = accepted.length ? average(accepted) : DEFAULT_METER;
    const voted = pro + con;
    const gap = pro - con;
    const threshold = Math.max(
      2,
      Math.min(Math.round(meter * participants), Math.max(2, voted)),
    );
    const passed = gap >= threshold;

    if (passed) {
      accepted.push(Math.min(1, Math.max(0, (gap + participants) / (2 * participants))));
    }

    const meterAfter = accepted.length ? average(accepted) : meter;
    const previous = index > 0 ? STAGES[index - 1].participants : null;

    return {
      participants,
      pro,
      con,
      voted,
      undecided: participants - pro - con,
      gap,
      threshold,
      passed,
      meter: Math.round(meter * 100),
      meterAfter: Math.round(meterAfter * 100),
      remaining: Math.max(0, threshold - gap),
      nextThreshold: Math.max(
        2,
        Math.min(Math.round(meterAfter * participants), Math.max(2, voted)),
      ),
      growth: previous === null ? null : participants - previous,
    };
  });
};

export const SEQUENCE = buildStages();

export const stateIndexFor = (percent) => (percent < 34 ? 0 : percent < 67 ? 1 : 2);