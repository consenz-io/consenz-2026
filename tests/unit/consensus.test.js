import test from 'node:test';
import assert from 'node:assert/strict';
import { computeConsensusUpdate } from '../../base44/shared/consensusLogic.ts';

/**
 * The consensus meter and the acceptance threshold are the heart of the
 * platform. These tests pin the published rules:
 *   - the meter is bounded to 0..1
 *   - the threshold never drops below the entry minimum of 2
 *   - the threshold never exceeds the number of people who actually voted
 */
test('a proposal with strong support raises the meter and the threshold', () => {
  const result = computeConsensusUpdate({ document: {}, delta: 6, totalUsers: 10, activeVoterCount: 0 });

  assert.equal(result.boundedConsensus, 0.8);
  assert.deepEqual(result.updatedConsensuses, [0.8]);
  assert.equal(result.consensusMeterAverage, 0.8);
  assert.equal(result.rawThreshold, 8);
  assert.equal(result.newThreshold, 8);
});

test('the threshold is capped by the number of people who voted', () => {
  const result = computeConsensusUpdate({ document: {}, delta: 6, totalUsers: 10, activeVoterCount: 5 });

  assert.equal(result.rawThreshold, 8);
  assert.equal(result.newThreshold, 5);
});

test('the meter never falls below zero', () => {
  const result = computeConsensusUpdate({ document: {}, delta: -50, totalUsers: 10, activeVoterCount: 0 });
  assert.equal(result.boundedConsensus, 0);
});

test('the meter never rises above one', () => {
  const result = computeConsensusUpdate({ document: {}, delta: 100, totalUsers: 10, activeVoterCount: 10 });
  assert.equal(result.boundedConsensus, 1);
  assert.equal(result.newThreshold, 10);
});

test('the threshold never drops below the entry minimum of 2', () => {
  const result = computeConsensusUpdate({ document: {}, delta: 0, totalUsers: 1, activeVoterCount: 1 });
  assert.ok(result.newThreshold >= 2, `threshold was ${result.newThreshold}`);
});

test('a new acceptance is appended to the existing history', () => {
  const result = computeConsensusUpdate({
    document: { consensuses: [0.5] },
    delta: 10,
    totalUsers: 10,
    activeVoterCount: 10,
  });

  assert.deepEqual(result.updatedConsensuses, [0.5, 1]);
  assert.equal(result.consensusMeterAverage, 0.75);
  assert.equal(result.rawThreshold, 8);
});

test('a document with no history starts from the current proposal only', () => {
  const result = computeConsensusUpdate({ document: { consensuses: [] }, delta: 0, totalUsers: 4, activeVoterCount: 0 });
  assert.equal(result.updatedConsensuses.length, 1);
  assert.equal(result.consensusMeterAverage, 0.5);
});