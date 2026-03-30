/**
 * voting.flow.test.js
 * 
 * Tests the critical voting flow:
 * vote cast → suggestion proVotes/conVotes updated → consensus check → auto-accept if threshold met
 * 
 * This is the most important flow in the app — a regression here breaks the entire collaboration mechanism.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkSuggestionConsensus } from '../components/document/suggestionAutoAccept';
import { calculateContributorsFromData } from '../components/document/calculateContributors';

// ─── Mock base44 SDK ───────────────────────────────────────────────────────────
vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      Suggestion: { filter: vi.fn() },
      Vote: { list: vi.fn() },
      UserPublicProfile: { list: vi.fn() },
      Argument: { list: vi.fn() },
      Comment: { list: vi.fn() },
      Section: { filter: vi.fn() },
    },
  },
}));

import { base44 } from '@/api/base44Client';

// ─── Shared test fixtures ──────────────────────────────────────────────────────
const makeDocument = (overrides = {}) => ({
  id: 'doc-1',
  threshold: 2,
  consensuses: [],
  gamificationEnabled: false,
  ...overrides,
});

const makeSuggestion = (overrides = {}) => ({
  id: 'sugg-1',
  documentId: 'doc-1',
  type: 'edit_section',
  sectionId: 'section-1',
  status: 'pending',
  proVotes: 0,
  conVotes: 0,
  title: 'Test suggestion',
  newContent: '<p>New content</p>',
  ...overrides,
});

const makeVote = (userId, suggestionId, voteType) => ({
  id: `vote-${userId}-${suggestionId}`,
  userId,
  suggestionId,
  vote: voteType,
  created_by: `user${userId}@test.com`,
});

const makeProfile = (userId, email) => ({
  userId,
  email,
  fullName: `User ${userId}`,
});

// ─── Setup default mocks before each test ─────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();

  base44.entities.Suggestion.filter.mockResolvedValue([]);
  base44.entities.Vote.list.mockResolvedValue([]);
  base44.entities.UserPublicProfile.list.mockResolvedValue([]);
  base44.entities.Argument.list.mockResolvedValue([]);
  base44.entities.Comment.list.mockResolvedValue([]);
  base44.entities.Section.filter.mockResolvedValue([]);
});

// ─── calculateContributorsFromData ────────────────────────────────────────────
describe('calculateContributorsFromData', () => {
  it('returns 1 (minimum) when no contributors exist', () => {
    const result = calculateContributorsFromData({ document: makeDocument() });
    expect(result).toBe(1);
  });

  it('counts voters correctly via userId→email mapping', () => {
    const suggestion = makeSuggestion();
    const vote = makeVote('user-1', 'sugg-1', 'pro');
    const profile = makeProfile('user-1', 'alice@test.com');

    const result = calculateContributorsFromData({
      document: makeDocument(),
      suggestions: [suggestion],
      allVotes: [vote],
      allUsers: [profile],
    });

    expect(result).toBe(1);
  });

  it('deduplicates same user voting on multiple suggestions', () => {
    const suggestions = [makeSuggestion({ id: 'sugg-1' }), makeSuggestion({ id: 'sugg-2' })];
    const votes = [
      makeVote('user-1', 'sugg-1', 'pro'),
      makeVote('user-1', 'sugg-2', 'con'),
    ];
    const profile = makeProfile('user-1', 'alice@test.com');

    const result = calculateContributorsFromData({
      document: makeDocument(),
      suggestions,
      allVotes: votes,
      allUsers: [profile],
    });

    // Same user, should count only once
    expect(result).toBe(1);
  });

  it('counts commenters on suggestions', () => {
    const suggestion = makeSuggestion();
    const comment = {
      id: 'c-1',
      rootEntityType: 'suggestion',
      rootEntityId: 'sugg-1',
      created_by: 'bob@test.com',
    };

    const result = calculateContributorsFromData({
      document: makeDocument(),
      suggestions: [suggestion],
      allComments: [comment],
    });

    expect(result).toBe(1);
  });

  it('counts signers of the document agreement', () => {
    const agreement = { documentId: 'doc-1', userId: 'user-1', userEmail: 'carol@test.com' };

    const result = calculateContributorsFromData({
      document: makeDocument(),
      documentAgreements: [agreement],
    });

    expect(result).toBe(1);
  });

  it('counts 3 distinct contributors correctly', () => {
    const suggestion = makeSuggestion();
    const vote = makeVote('user-1', 'sugg-1', 'pro');
    const profile = makeProfile('user-1', 'alice@test.com');
    const comment = { rootEntityType: 'suggestion', rootEntityId: 'sugg-1', created_by: 'bob@test.com' };
    const agreement = { documentId: 'doc-1', userId: 'user-3', userEmail: 'carol@test.com' };

    const result = calculateContributorsFromData({
      document: makeDocument(),
      suggestions: [suggestion],
      allVotes: [vote],
      allUsers: [profile],
      allComments: [comment],
      documentAgreements: [agreement],
    });

    expect(result).toBe(3);
  });

  it('ignores votes on suggestions from other documents', () => {
    // Suggestion belongs to doc-1, vote references sugg-99 (different doc)
    const suggestion = makeSuggestion({ id: 'sugg-1' });
    const foreignVote = makeVote('user-1', 'sugg-99', 'pro'); // not in our suggestions

    const result = calculateContributorsFromData({
      document: makeDocument(),
      suggestions: [suggestion],
      allVotes: [foreignVote],
      allUsers: [makeProfile('user-1', 'alice@test.com')],
    });

    expect(result).toBe(1); // minimum, no real contributors
  });
});

// ─── checkSuggestionConsensus ─────────────────────────────────────────────────
describe('checkSuggestionConsensus', () => {
  it('should NOT accept when delta < threshold', async () => {
    const suggestion = makeSuggestion({ proVotes: 1, conVotes: 0 }); // delta = 1
    const doc = makeDocument({ threshold: 2 }); // needs 2

    const { shouldAccept, threshold } = await checkSuggestionConsensus(suggestion, doc);

    expect(shouldAccept).toBe(false);
    expect(threshold).toBe(2);
  });

  it('should accept when delta === threshold (boundary condition)', async () => {
    const suggestion = makeSuggestion({ proVotes: 2, conVotes: 0 }); // delta = 2
    const doc = makeDocument({ threshold: 2 });

    const { shouldAccept } = await checkSuggestionConsensus(suggestion, doc);

    expect(shouldAccept).toBe(true);
  });

  it('should accept when delta > threshold', async () => {
    const suggestion = makeSuggestion({ proVotes: 5, conVotes: 1 }); // delta = 4
    const doc = makeDocument({ threshold: 2 });

    const { shouldAccept } = await checkSuggestionConsensus(suggestion, doc);

    expect(shouldAccept).toBe(true);
  });

  it('should NOT accept when con votes cancel out pro votes', async () => {
    const suggestion = makeSuggestion({ proVotes: 3, conVotes: 2 }); // delta = 1
    const doc = makeDocument({ threshold: 2 });

    const { shouldAccept } = await checkSuggestionConsensus(suggestion, doc);

    expect(shouldAccept).toBe(false);
  });

  it('enforces minimum threshold of 2', async () => {
    const suggestion = makeSuggestion({ proVotes: 1, conVotes: 0 }); // delta = 1
    const doc = makeDocument({ threshold: 1 }); // document says 1, but minimum is 2

    const { shouldAccept, threshold } = await checkSuggestionConsensus(suggestion, doc);

    // threshold should be Math.max(2, 1) = 2, so delta=1 should NOT pass
    expect(shouldAccept).toBe(false);
    expect(threshold).toBe(2);
  });

  it('returns correct consensus (delta) value', async () => {
    const suggestion = makeSuggestion({ proVotes: 4, conVotes: 1 }); // delta = 3
    const doc = makeDocument({ threshold: 2 });

    const { consensus, shouldAccept } = await checkSuggestionConsensus(suggestion, doc);

    expect(consensus).toBe(3);
    expect(shouldAccept).toBe(true);
  });

  it('handles zero votes correctly', async () => {
    const suggestion = makeSuggestion({ proVotes: 0, conVotes: 0 });
    const doc = makeDocument({ threshold: 2 });

    const { shouldAccept, consensus } = await checkSuggestionConsensus(suggestion, doc);

    expect(shouldAccept).toBe(false);
    expect(consensus).toBe(0);
  });
});

// ─── Vote flow: cast vote → consensus check ───────────────────────────────────
describe('Voting flow: pro vote tips threshold', () => {
  it('suggestion should not be accepted before reaching threshold', async () => {
    const suggestion = makeSuggestion({ proVotes: 1, conVotes: 0 });
    const doc = makeDocument({ threshold: 2 });

    const { shouldAccept } = await checkSuggestionConsensus(suggestion, doc);
    expect(shouldAccept).toBe(false);
  });

  it('suggestion should be accepted after second pro vote reaches threshold', async () => {
    // Simulate state AFTER second vote is counted
    const suggestionAfterVote = makeSuggestion({ proVotes: 2, conVotes: 0 });
    const doc = makeDocument({ threshold: 2 });

    const { shouldAccept } = await checkSuggestionConsensus(suggestionAfterVote, doc);
    expect(shouldAccept).toBe(true);
  });

  it('a con vote should push back below threshold', async () => {
    // Was at delta=2, someone adds a con vote → delta=1
    const suggestion = makeSuggestion({ proVotes: 2, conVotes: 1 });
    const doc = makeDocument({ threshold: 2 });

    const { shouldAccept } = await checkSuggestionConsensus(suggestion, doc);
    expect(shouldAccept).toBe(false);
  });
});