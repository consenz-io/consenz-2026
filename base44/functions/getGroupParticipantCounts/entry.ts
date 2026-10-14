import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/**
 * Returns participant counts per group, computed server-side.
 *
 * Replaces the client-side approach that fetched 12,000+ records
 * (suggestions, votes, sections, sectionVotes, comments, agreements,
 * UserPublicProfile) into the browser just to count unique participants.
 *
 * Only the final { groupId: count } map is sent to the client.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const groupIds = body?.groupIds;
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return Response.json({ counts: {} });
    }

    const svc = base44.asServiceRole;

    // Step 1: Documents for these groups (just IDs + groupId)
    const documents = await svc.entities.Document.filter(
      { groupId: { $in: groupIds } }, null, 1000
    );
    const docIds = documents.map(d => d.id);
    const docIdToGroupId = new Map(documents.map(d => [d.id, d.groupId]));

    // No documents → only formal members count
    if (docIds.length === 0) {
      const members = await svc.entities.GroupMember.filter(
        { groupId: { $in: groupIds } }, null, 2000
      );
      const counts = {};
      const sets = new Map(groupIds.map(gid => [gid, new Set()]));
      for (const m of members) {
        if (m.groupId && m.userId && sets.has(m.groupId)) {
          sets.get(m.groupId).add(m.userId);
        }
      }
      sets.forEach((s, gid) => { counts[gid] = s.size; });
      return Response.json({ counts });
    }

    // Step 2: Suggestions + Sections for those documents
    const [suggestions, sections] = await Promise.all([
      svc.entities.Suggestion.filter(
        { documentId: { $in: docIds } }, null, 2000
      ),
      svc.entities.Section.filter(
        { documentId: { $in: docIds } }, null, 1000
      ),
    ]);

    const suggestionIdToGroupId = new Map();
    for (const s of suggestions) {
      const gid = docIdToGroupId.get(s.documentId);
      if (gid) suggestionIdToGroupId.set(s.id, gid);
    }
    const suggestionIds = suggestions.map(s => s.id);

    const sectionIdToGroupId = new Map();
    for (const s of sections) {
      const gid = docIdToGroupId.get(s.documentId);
      if (gid) sectionIdToGroupId.set(s.id, gid);
    }
    const sectionIds = sections.map(s => s.id);

    // Step 3: Fetch all remaining data in parallel (max 6 concurrent)
    const allRootEntityIds = [...docIds, ...suggestionIds, ...sectionIds];

    const [members, votes, sectionVotes, comments, agreements, profiles] = await Promise.all([
      svc.entities.GroupMember.filter(
        { groupId: { $in: groupIds } }, null, 2000
      ),
      suggestionIds.length > 0
        ? svc.entities.Vote.filter(
            { suggestionId: { $in: suggestionIds } }, null, 2000
          )
        : Promise.resolve([]),
      sectionIds.length > 0
        ? svc.entities.SectionVote.filter(
            { sectionId: { $in: sectionIds } }, null, 2000
          )
        : Promise.resolve([]),
      allRootEntityIds.length > 0
        ? svc.entities.Comment.filter(
            { rootEntityId: { $in: allRootEntityIds } }, null, 2000
          )
        : Promise.resolve([]),
      svc.entities.DocumentAgreement.filter(
        { documentId: { $in: docIds } }, null, 500
      ),
      svc.entities.UserPublicProfile.list(null, 1000),
    ]);

    // Build email → userId map
    const emailToUserId = new Map();
    const validUserIds = new Set();
    for (const p of profiles) {
      if (p.email && p.userId) emailToUserId.set(p.email, p.userId);
      if (p.userId) validUserIds.add(p.userId);
    }

    // Build groupId → Set of participant userIds
    const groupSets = new Map(groupIds.map(gid => [gid, new Set()]));

    // 1. Formal group members
    for (const m of members) {
      if (m.groupId && m.userId && validUserIds.has(m.userId)) {
        groupSets.get(m.groupId)?.add(m.userId);
      }
    }

    // 2. Suggestion creators
    for (const s of suggestions) {
      const gid = docIdToGroupId.get(s.documentId);
      if (!gid || !s.created_by) continue;
      const uid = emailToUserId.get(s.created_by);
      if (uid) groupSets.get(gid)?.add(uid);
    }

    // 3. Voters
    for (const v of votes) {
      if (!v.userId || !validUserIds.has(v.userId)) continue;
      const gid = suggestionIdToGroupId.get(v.suggestionId);
      if (gid) groupSets.get(gid)?.add(v.userId);
    }

    // 4. Commenters
    for (const c of comments) {
      if (!c.created_by) continue;
      let gid = null;
      if (c.rootEntityType === 'document') gid = docIdToGroupId.get(c.rootEntityId);
      else if (c.rootEntityType === 'suggestion') gid = suggestionIdToGroupId.get(c.rootEntityId);
      else if (c.rootEntityType === 'section') gid = sectionIdToGroupId.get(c.rootEntityId);
      if (gid) {
        const uid = emailToUserId.get(c.created_by);
        if (uid) groupSets.get(gid)?.add(uid);
      }
    }

    // 5. Agreement signers
    for (const a of agreements) {
      if (!a.userId || !validUserIds.has(a.userId)) continue;
      const gid = docIdToGroupId.get(a.documentId);
      if (gid) groupSets.get(gid)?.add(a.userId);
    }

    // 6. Section voters
    for (const v of sectionVotes) {
      if (!v.userId || !validUserIds.has(v.userId)) continue;
      const gid = sectionIdToGroupId.get(v.sectionId);
      if (gid) groupSets.get(gid)?.add(v.userId);
    }

    const counts = {};
    groupSets.forEach((s, gid) => { counts[gid] = s.size; });

    return Response.json({ counts });
  } catch (error) {
    console.error('[getGroupParticipantCounts]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}