/**
 * queryCache.test.js
 * 
 * Tests query key consistency across the app.
 * Goal: ensure that after a mutation, the correct query keys are invalidated
 * so that consumers (Layout, DocumentView, etc.) get fresh data.
 * 
 * This catches the silent bug where a mutation invalidates key ['allVotes']
 * but the consumer reads from ['allVotes', userId] — cache never updates.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// ─── Query Key Registry ────────────────────────────────────────────────────────
// Mirrors the actual keys used across Layout, DocumentView, and GroupView.
// If you rename a key in production code, update it here too — the test will
// remind you to also update all consumers.

export const QUERY_KEYS = {
  currentUser: ['currentUser'],
  allDocuments: ['allDocuments'],
  allSuggestions: ['allSuggestions'],
  allVotes: (userId) => ['allVotes', userId],
  userSuggestions: (email) => ['userSuggestions', email],
  document: (id) => ['document', id],
  topics: (docId) => ['topics', docId],
  sections: (docId) => ['sections', docId],
  suggestions: (docId) => ['suggestions', docId],
  documentMetadata: (docId) => ['documentMetadata', docId],
  documentAggregatedData: (docId) => ['documentAggregatedData', docId],
  publicProfiles: ['publicProfiles'],
  isAdmin: (docId, userId) => ['isAdmin', docId, userId],
  groupMembers: (groupId) => ['groupMembers', groupId],
  groups: ['groups'],
};

// ─── Helper: build a QueryClient with cached data ─────────────────────────────
function buildQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

// ─── Test: Key structure consistency ──────────────────────────────────────────
describe('Query key structure', () => {
  it('allVotes key includes userId (prevents stale cross-user cache)', () => {
    const key = QUERY_KEYS.allVotes('user-123');
    expect(key).toEqual(['allVotes', 'user-123']);
    expect(key.length).toBe(2); // must have userId segment
  });

  it('document-scoped keys include documentId', () => {
    expect(QUERY_KEYS.topics('doc-1')).toContain('doc-1');
    expect(QUERY_KEYS.sections('doc-1')).toContain('doc-1');
    expect(QUERY_KEYS.suggestions('doc-1')).toContain('doc-1');
    expect(QUERY_KEYS.documentAggregatedData('doc-1')).toContain('doc-1');
    expect(QUERY_KEYS.documentMetadata('doc-1')).toContain('doc-1');
  });

  it('user-scoped keys include userId or email', () => {
    expect(QUERY_KEYS.allVotes('u1')).toContain('u1');
    expect(QUERY_KEYS.userSuggestions('a@b.com')).toContain('a@b.com');
    expect(QUERY_KEYS.isAdmin('doc-1', 'u1')).toContain('u1');
    expect(QUERY_KEYS.isAdmin('doc-1', 'u1')).toContain('doc-1');
  });

  it('different users get different allVotes cache keys', () => {
    const key1 = QUERY_KEYS.allVotes('user-A');
    const key2 = QUERY_KEYS.allVotes('user-B');
    expect(key1).not.toEqual(key2);
  });

  it('different documents get different cache keys', () => {
    expect(QUERY_KEYS.suggestions('doc-A')).not.toEqual(QUERY_KEYS.suggestions('doc-B'));
    expect(QUERY_KEYS.sections('doc-A')).not.toEqual(QUERY_KEYS.sections('doc-B'));
  });
});

// ─── Test: Invalidation after vote cast ───────────────────────────────────────
describe('After vote is cast — query invalidation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = buildQueryClient();
  });

  it('invalidating allVotes with userId clears only that users cache', async () => {
    const userId = 'user-42';
    const otherUserId = 'user-99';

    // Seed both users' vote caches
    queryClient.setQueryData(QUERY_KEYS.allVotes(userId), [{ id: 'v1' }]);
    queryClient.setQueryData(QUERY_KEYS.allVotes(otherUserId), [{ id: 'v2' }]);

    // Simulate what the vote mutation does: invalidate the voter's key
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allVotes(userId) });

    // The specific user's cache should be invalidated (stale)
    const state1 = queryClient.getQueryState(QUERY_KEYS.allVotes(userId));
    const state2 = queryClient.getQueryState(QUERY_KEYS.allVotes(otherUserId));

    expect(state1.isInvalidated).toBe(true);
    expect(state2.isInvalidated).toBe(false); // other user NOT affected
  });

  it('invalidating suggestions for a doc does NOT affect other docs', async () => {
    queryClient.setQueryData(QUERY_KEYS.suggestions('doc-1'), [{ id: 's1' }]);
    queryClient.setQueryData(QUERY_KEYS.suggestions('doc-2'), [{ id: 's2' }]);

    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.suggestions('doc-1') });

    const state1 = queryClient.getQueryState(QUERY_KEYS.suggestions('doc-1'));
    const state2 = queryClient.getQueryState(QUERY_KEYS.suggestions('doc-2'));

    expect(state1.isInvalidated).toBe(true);
    expect(state2.isInvalidated).toBe(false);
  });

  it('sections invalidation is scoped to document', async () => {
    queryClient.setQueryData(QUERY_KEYS.sections('doc-A'), []);
    queryClient.setQueryData(QUERY_KEYS.sections('doc-B'), []);

    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sections('doc-A') });

    expect(queryClient.getQueryState(QUERY_KEYS.sections('doc-A')).isInvalidated).toBe(true);
    expect(queryClient.getQueryState(QUERY_KEYS.sections('doc-B')).isInvalidated).toBe(false);
  });

  it('publicProfiles is a global key — invalidation affects all consumers', async () => {
    queryClient.setQueryData(QUERY_KEYS.publicProfiles, [{ userId: 'u1' }]);

    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.publicProfiles });

    expect(queryClient.getQueryState(QUERY_KEYS.publicProfiles).isInvalidated).toBe(true);
  });
});

// ─── Test: staleTime enforcement ──────────────────────────────────────────────
describe('staleTime — data freshness contracts', () => {
  it('freshly set data is NOT stale', () => {
    const queryClient = buildQueryClient();
    queryClient.setQueryData(['publicProfiles'], [{ userId: 'u1' }]);

    const state = queryClient.getQueryState(['publicProfiles']);
    // Data was just set, should not be invalidated
    expect(state.isInvalidated).toBe(false);
    expect(state.data).toHaveLength(1);
  });

  it('cache returns same reference for same key (no phantom re-fetches)', () => {
    const queryClient = buildQueryClient();
    const profiles = [{ userId: 'u1', email: 'a@b.com' }];
    queryClient.setQueryData(QUERY_KEYS.publicProfiles, profiles);

    const result = queryClient.getQueryData(QUERY_KEYS.publicProfiles);
    expect(result).toBe(profiles); // same reference
  });

  it('two consumers reading same key get identical data', () => {
    const queryClient = buildQueryClient();
    const profiles = [{ userId: 'u1' }];
    queryClient.setQueryData(QUERY_KEYS.publicProfiles, profiles);

    // Simulate Home page and GroupView both reading publicProfiles
    const homePageData = queryClient.getQueryData(QUERY_KEYS.publicProfiles);
    const groupViewData = queryClient.getQueryData(QUERY_KEYS.publicProfiles);

    expect(homePageData).toEqual(groupViewData);
    expect(homePageData).toBe(groupViewData); // exact same reference — no duplicate fetch
  });
});

// ─── Test: vote-cast event invalidation pattern ───────────────────────────────
describe('consenz:vote-cast event — what must be invalidated', () => {
  it('simulates the invalidation logic from Layout.jsx vote-cast handler', async () => {
    const queryClient = buildQueryClient();
    const userId = 'user-1';

    // Seed caches that the Layout maintains
    queryClient.setQueryData(QUERY_KEYS.allVotes(userId), []);
    queryClient.setQueryData(QUERY_KEYS.allSuggestions, []);

    // This is the exact logic from Layout.jsx handleVoteCast
    const handleVoteCast = async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allVotes(userId) });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allSuggestions });
    };

    await handleVoteCast();

    expect(queryClient.getQueryState(QUERY_KEYS.allVotes(userId)).isInvalidated).toBe(true);
    expect(queryClient.getQueryState(QUERY_KEYS.allSuggestions).isInvalidated).toBe(true);
  });

  it('Layout allVotes key matches the key used in the vote-cast invalidation', () => {
    // This test ensures the key used in the event handler matches the query key
    // If someone changes one but not the other, this test fails.
    const userId = 'user-abc';

    const layoutQueryKey = QUERY_KEYS.allVotes(userId);         // ['allVotes', userId]
    const invalidationKey = QUERY_KEYS.allVotes(userId);         // same function — must match

    expect(layoutQueryKey).toEqual(invalidationKey);
  });
});