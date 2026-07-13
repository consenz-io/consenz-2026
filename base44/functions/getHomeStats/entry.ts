import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Returns aggregate home-page stats computed server-side.
 * Replaces 6 client-side queries (allSuggestions, allVotes, allComments,
 * allSections, allAgreements, acceptedSuggestions — up to 12,000 records)
 * with a single round-trip returning only the computed numbers + contributor list.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === 'admin';

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
          email,
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

    const groupParticipantCounts = {};
    groupParticipantSets.forEach((idSet, gid) => { groupParticipantCounts[gid] = idSet.size; });

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
      });
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

    const documentContributorCounts = {};
    docContributorSets.forEach((set, docId) => {
      documentContributorCounts[docId] = set.size;
    });

    return Response.json({
      documentsCount: documents.length,
      totalUniqueContributors: Math.max(1, uniqueParticipants.size),
      contributorsList,
      averageConsensus,
      groupParticipantCounts,
      documentContributorCounts,
      displayedUsers,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});