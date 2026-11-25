import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { verifyGroupMembership } from '../../shared/documentAuth.ts';

/**
 * Returns aggregate home-page stats computed server-side.
 * Replaces 6 client-side queries (allSuggestions, allVotes, allComments,
 * allSections, allAgreements, acceptedSuggestions — up to 12,000 records)
 * with a single round-trip returning only the computed numbers + contributor list.
 *
 * Server-side TTL cache (60s): the home page is high-traffic and the stats
 * don't need to be real-time. Caching amortizes 11 queries + heavy in-memory
 * joins across all users hitting the home page within the window.
 * Keyed by role: shared stats (counts, contributors, displayedUsers) are
 * the same per role. Per-caller fields (groupParticipantCounts,
 * documentContributorCounts) are NOT cached as response data — they are
 * filtered per-request from cached raw size maps + the caller's own group
 * memberships, so private-group participant counts never leak across users.
 */
const CACHE_TTL_MS = 60 * 1000;
const statsCache = new Map(); // key: 'admin' | 'user' → { sharedStats, groupParticipantSizes, docContributorSizes, docIdToGroupId, groupStatusById, expiresAt }

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of statsCache.entries()) {
    if (now >= entry.expiresAt) statsCache.delete(key);
  }
}, 60 * 1000);

// In-flight computations, keyed like the cache. The home page is hit by many
// visitors at the same moment; without this, every request that arrives right
// after the cache expires starts its own copy of the same 11 table scans.
const computeInflight = new Map<string, { promise: Promise<void>; release: () => void }>();

/**
 * Builds the per-caller response from a cached computation. Shared stats are
 * identical for everyone; only group/document visibility depends on the caller,
 * so this filter runs per request and never reuses another user's visibility.
 */
function buildResponse(entry: any, isAdmin: boolean, verifiedMemberGroupIds: Set<string>) {
  const canSeeGroup = (gid: string) =>
    isAdmin ||
    verifiedMemberGroupIds.has(gid) ||
    entry.groupStatusById.get(gid) === 'public';

  const groupParticipantCounts: Record<string, number> = {};
  for (const [gid, size] of entry.groupParticipantSizes.entries()) {
    if (canSeeGroup(gid as string)) groupParticipantCounts[gid as string] = size as number;
  }

  const documentContributorCounts: Record<string, number> = {};
  for (const [docId, size] of entry.docContributorSizes.entries()) {
    const gid = entry.docIdToGroupId.get(docId as string);
    if (gid && !canSeeGroup(gid)) continue;
    documentContributorCounts[docId as string] = size as number;
  }

  return Response.json({
    ...entry.sharedStats,
    groupParticipantCounts,
    documentContributorCounts,
  });
}

Deno.serve(async (req) => {
  let releaseKey: string | null = null;
  try {
    const base44 = createClientFromRequest(req);
    // Public app: anonymous visitors get public-only stats (no 401).
    // isAdmin is false and verifiedMemberGroupIds is empty, so only public
    // group counts are returned.
    const user = await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === 'admin';

    // A GroupMember record is NOT proof of membership: its create rule is
    // open, so anyone can mint a record naming any private/hidden group.
    // Only memberships verified with provenance count as "member of a
    // private/hidden group". Public groups need no membership at all.
    const verifiedMemberGroupIds = new Set<string>();
    if (user && !isAdmin) {
      const memberships = await base44.asServiceRole.entities.GroupMember
        .filter({ userId: user.id }).catch(() => []);
      const memberGroupIds = [...new Set(memberships.map((m: any) => m.groupId).filter(Boolean))];
      const memberGroups = memberGroupIds.length
        ? await base44.asServiceRole.entities.Group.filter({ id: { $in: memberGroupIds } }).catch(() => [])
        : [];
      for (const g of memberGroups) {
        if (g.status !== 'private' && g.status !== 'hidden') verifiedMemberGroupIds.add(g.id);
      }
      // Verify the private/hidden groups in parallel. Each check issues up to
      // four sequential queries, so awaiting them one at a time multiplied the
      // request's latency by the number of private groups the caller belongs to.
      const restrictedGroups = memberGroups.filter(
        (g: any) => g.status === 'private' || g.status === 'hidden'
      );
      const verifications = await Promise.all(
        restrictedGroups.map(async (g: any) => ({
          id: g.id,
          ...(await verifyGroupMembership(base44, g, user)),
        }))
      );
      for (const v of verifications) if (v.isMember) verifiedMemberGroupIds.add(v.id);
    }

    const cacheKey = user ? (isAdmin ? 'admin' : 'user') : 'anonymous';
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return buildResponse(cached, isAdmin, verifiedMemberGroupIds);
    }

    // Single flight — if another request is already recomputing this key, wait
    // for it and reuse its result instead of repeating the scans in parallel.
    const inFlight = computeInflight.get(cacheKey);
    if (inFlight) {
      await inFlight.promise;
      const fresh = statsCache.get(cacheKey);
      if (fresh) return buildResponse(fresh, isAdmin, verifiedMemberGroupIds);
    } else {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => { release = resolve; });
      computeInflight.set(cacheKey, { promise, release });
      releaseKey = cacheKey;
    }

    const [
      groups, groupMembers, documents, suggestions, votes,
      comments, agreements, publicProfiles, acceptedSuggestions,
      sections, sectionVotes,
    ] = await Promise.all([
      base44.asServiceRole.entities.Group.list('-created_date', 50),
      base44.asServiceRole.entities.GroupMember.list(),
      base44.asServiceRole.entities.Document.list('-created_date', 200),
      base44.asServiceRole.entities.Suggestion.list('-created_date', 2000),
      base44.asServiceRole.entities.Vote.list('-created_date', 2000),
      base44.asServiceRole.entities.Comment.list('-created_date', 2000),
      base44.asServiceRole.entities.DocumentAgreement.list(),
      base44.asServiceRole.entities.UserPublicProfile.list(),
      base44.asServiceRole.entities.Suggestion.filter({ status: 'accepted' }),
      base44.asServiceRole.entities.Section.list(null, 2000),
      base44.asServiceRole.entities.SectionVote.list('-created_date', 2000),
    ]);

    // ── email → userId map (built once) ──
    const emailToUserId = new Map();
    const userIdToProfile = new Map();
    for (const p of publicProfiles) {
      if (p.email && p.userId) emailToUserId.set(p.email, p.userId);
      if (p.userId) userIdToProfile.set(p.userId, p);
    }

    // Admin-only: fetch User records for fuller name resolution
    let allUsers: any[] = [];
    if (isAdmin) {
      try {
        allUsers = await base44.asServiceRole.entities.User.list('-created_date');
      } catch { allUsers = []; }
    }

    // ── Average consensus from accepted suggestions ──
    let averageConsensus = 0;
    if (acceptedSuggestions.length > 0) {
      const scores = acceptedSuggestions
        .filter(s => typeof s.proVotes === 'number' && typeof s.conVotes === 'number')
        .map(s => { const t = s.proVotes + s.conVotes; return t > 0 ? s.proVotes / t : 0; });
      if (scores.length > 0) {
        averageConsensus = Math.round((scores.reduce((a, s) => a + s, 0) / scores.length) * 100);
      }
    }

    // ── Total unique contributors (userId as primary key, email as fallback) ──
    const uniqueParticipants = new Set();

    const addParticipant = (userId, email) => {
      if (userId) uniqueParticipants.add(userId);
      else if (email) { const uid = emailToUserId.get(email); uniqueParticipants.add(uid || email); }
    };

    for (const v of votes) { addParticipant(v.userId, v.created_by); }
    for (const v of sectionVotes) { addParticipant(v.userId, v.created_by); }
    for (const c of comments) { addParticipant(c.created_by_id, c.created_by); }
    for (const a of agreements) { addParticipant(a.userId, a.userEmail); }
    for (const s of suggestions) { addParticipant(s.created_by_id, s.created_by); }

    // Every registered user counts as a participant of the platform, so someone
    // who just signed up appears in the home page's general participants list
    // even before they vote, comment or propose anything.
    for (const p of publicProfiles) {
      if (p.userId) uniqueParticipants.add(p.userId);
    }

    // Collapse: if a user's userId is already counted, remove their email key too
    // (prevents double-count when email-only records didn't resolve to userId)
    for (const p of publicProfiles) {
      if (p.userId && p.email && uniqueParticipants.has(p.userId)) {
        uniqueParticipants.delete(p.email);
      }
    }

    // Build contributors list
    const emailToUser = new Map();
    for (const u of allUsers) { if (u.email) emailToUser.set(u.email, u); }
    // Build contributors list from uniqueParticipants (mix of userIds and unresolved emails)
    const contributorEmails = new Set();
    const contributorIds = new Set();
    for (const key of uniqueParticipants) {
      // If it looks like a userId (UUID), resolve to profile; otherwise treat as email
      const profile = userIdToProfile.get(key);
      if (profile) {
        contributorIds.add(profile.userId);
        if (profile.email) contributorEmails.add(profile.email);
      } else if (key.includes('@')) {
        contributorEmails.add(key);
        const uid = emailToUserId.get(key);
        if (uid) contributorIds.add(uid);
      } else {
        contributorIds.add(key);
      }
    }

    const contributorsList = Array.from(new Set([...contributorEmails, ...Array.from(contributorIds).map(id => {
      const p = userIdToProfile.get(id);
      return p?.email;
    }).filter(Boolean)]))
      .map(email => {
        const profile = userIdToProfile.get(emailToUserId.get(email) || '');
        const u = emailToUser.get(email);
        return {
          // Email is only returned to admins to prevent mass harvesting by
          // unauthenticated callers; non-admins get name + id only.
          ...(isAdmin ? { email } : {}),
          name: profile?.fullName || u?.full_name || (email ? email.split('@')[0] : 'User'),
          id: profile?.userId || u?.id
        };
      })
      .filter(c => c.name && c.name !== 'User')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // ── Group participant counts (single pass, same logic as calcAllGroupParticipants) ──
    const docIdToGroupId = new Map();
    for (const d of documents) { if (d.groupId) docIdToGroupId.set(d.id, d.groupId); }

    const suggestionIdToGroupId = new Map();
    const sectionIdToGroupId = new Map();
    const groupParticipantSets = new Map();
    for (const g of groups) groupParticipantSets.set(g.id, new Set());

    // Formal members
    for (const m of groupMembers) {
      if (m.groupId && groupParticipantSets.has(m.groupId) && m.userId) {
        groupParticipantSets.get(m.groupId).add(m.userId);
      }
    }
    // Suggestion creators
    for (const s of suggestions) {
      const gid = docIdToGroupId.get(s.documentId);
      if (!gid || !groupParticipantSets.has(gid)) continue;
      suggestionIdToGroupId.set(s.id, gid);
      if (s.created_by) {
        const uid = emailToUserId.get(s.created_by);
        if (uid) groupParticipantSets.get(gid).add(uid);
      }
    }
    // Voters
    for (const v of votes) {
      if (!v.userId) continue;
      const gid = suggestionIdToGroupId.get(v.suggestionId);
      if (gid && groupParticipantSets.has(gid)) groupParticipantSets.get(gid).add(v.userId);
    }
    // Sections → groupId
    for (const s of sections) {
      const gid = docIdToGroupId.get(s.documentId);
      if (gid) sectionIdToGroupId.set(s.id, gid);
    }
    // Section voters → groupId
    for (const v of sectionVotes) {
      if (!v.userId) continue;
      const gid = sectionIdToGroupId.get(v.sectionId);
      if (gid && groupParticipantSets.has(gid)) groupParticipantSets.get(gid).add(v.userId);
    }
    // Commenters
    for (const c of comments) {
      if (!c.created_by) continue;
      let gid = null;
      if (c.rootEntityType === 'document') gid = docIdToGroupId.get(c.rootEntityId);
      else if (c.rootEntityType === 'suggestion') gid = suggestionIdToGroupId.get(c.rootEntityId);
      else if (c.rootEntityType === 'section') gid = sectionIdToGroupId.get(c.rootEntityId);
      if (gid && groupParticipantSets.has(gid)) {
        const uid = emailToUserId.get(c.created_by);
        if (uid) groupParticipantSets.get(gid).add(uid);
      }
    }
    // Agreement signers
    for (const a of agreements) {
      if (!a.userId) continue;
      const gid = docIdToGroupId.get(a.documentId);
      if (gid && groupParticipantSets.has(gid)) groupParticipantSets.get(gid).add(a.userId);
    }

    // Collapse email/userId duplicates for ALL groups (not per-caller), then
    // store raw sizes. Per-caller visibility filtering is applied after the
    // cache so private-group counts never leak across users.
    const groupParticipantSizes = new Map();
    groupParticipantSets.forEach((idSet, gid) => {
      // Walk the set, not every profile: this was O(groups × all users) — with
      // 50 groups and a few thousand profiles that is hundreds of thousands of
      // iterations on every recompute. Now it is O(entries in the set).
      for (const key of idSet) {
        if (typeof key !== 'string' || !key.includes('@')) continue;
        const uid = emailToUserId.get(key);
        if (uid && idSet.has(uid)) idSet.delete(key);
      }
      groupParticipantSizes.set(gid, idSet.size);
    });

    // ── Displayed users (for non-admins: just public profiles; for admins: all users) ──
    let displayedUsers;
    if (isAdmin && allUsers.length > 0) {
      displayedUsers = allUsers;
    } else {
      const seen = new Set();
      displayedUsers = publicProfiles.filter(p => {
        if (!p?.userId || seen.has(p.userId)) return false;
        seen.add(p.userId);
        return true;
      }).map(p => ({ userId: p.userId, fullName: p.fullName, avatar: p.avatar }));
    }

    // ── Per-document contributor counts (userId as primary key, email as fallback) ──
    const docContributorSets = new Map();
    for (const d of documents) docContributorSets.set(d.id, new Set());

    const addDocParticipant = (docId, userId, email) => {
      const set = docContributorSets.get(docId);
      if (!set) return;
      if (userId) set.add(userId);
      else if (email) { const uid = emailToUserId.get(email); set.add(uid || email); }
    };

    const suggestionIdToDocId = new Map();
    for (const s of suggestions) {
      suggestionIdToDocId.set(s.id, s.documentId);
      addDocParticipant(s.documentId, s.created_by_id, s.created_by);
    }

    for (const v of votes) {
      const docId = suggestionIdToDocId.get(v.suggestionId);
      if (!docId) continue;
      addDocParticipant(docId, v.userId, v.created_by);
    }

    const sectionIdToDocId = new Map();
    for (const s of sections) { sectionIdToDocId.set(s.id, s.documentId); }

    for (const v of sectionVotes) {
      const docId = sectionIdToDocId.get(v.sectionId);
      if (!docId) continue;
      addDocParticipant(docId, v.userId, v.created_by);
    }

    for (const c of comments) {
      let docId = null;
      if (c.rootEntityType === 'document') docId = c.rootEntityId;
      else if (c.rootEntityType === 'suggestion') docId = suggestionIdToDocId.get(c.rootEntityId);
      else if (c.rootEntityType === 'section') docId = sectionIdToDocId.get(c.rootEntityId);
      if (!docId) continue;
      addDocParticipant(docId, c.created_by_id, c.created_by);
    }

    for (const a of agreements) {
      addDocParticipant(a.documentId, a.userId, a.userEmail);
    }

    // Collapse email/userId duplicates for ALL documents, store raw sizes.
    // Per-caller visibility filtering is applied after the cache.
    const docContributorSizes = new Map();
    docContributorSets.forEach((set, docId) => {
      for (const key of set) {
        if (key.includes('@')) {
          const uid = emailToUserId.get(key);
          if (uid && set.has(uid)) set.delete(key);
        }
      }
      docContributorSizes.set(docId, set.size);
    });

    // Per-caller visibility filtering now lives in buildResponse(), so the
    // cached entry only stores raw, unfiltered sizes.
    const groupStatusById = new Map(groups.map(g => [g.id, g.status]));

    const sharedStats = {
      documentsCount: documents.length,
      totalUniqueContributors: Math.max(1, contributorsList.length),
      contributorsList,
      averageConsensus,
      displayedUsers,
    };

    // Cache shared stats + raw size maps (server-side only, never sent
    // unfiltered to any client). Per-caller filtering runs on every request.
    const entry = {
      sharedStats,
      groupParticipantSizes,
      docContributorSizes,
      docIdToGroupId,
      groupStatusById,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    statsCache.set(cacheKey, entry);

    return buildResponse(entry, isAdmin, verifiedMemberGroupIds);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  } finally {
    // Always free the single-flight slot, so a failed computation never
    // leaves later requests waiting on a promise that will never resolve.
    if (releaseKey) {
      computeInflight.get(releaseKey)?.release();
      computeInflight.delete(releaseKey);
    }
  }
});