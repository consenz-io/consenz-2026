import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/**
 * Everything the "My Documents" page needs, aggregated server-side.
 *
 * Previously the browser fetched every suggestion, vote, section, section vote
 * and comment belonging to all of the user's documents — full records with
 * rich-text bodies — just to show four numbers per card. Now the records never
 * leave the server: the response is the document cards' data plus per-document
 * counters.
 */
const MAX_RECORDS = 5000;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;

    // 1. Which documents has this user participated in?
    const [interactions, mySuggestions, myCreatedDocs, myVotes] = await Promise.all([
      svc.entities.UserInteraction.filter({ userId: user.id }, null, MAX_RECORDS),
      user.email ? svc.entities.Suggestion.filter({ created_by: user.email }, null, MAX_RECORDS) : [],
      user.email ? svc.entities.Document.filter({ created_by: user.email }, null, MAX_RECORDS) : [],
      svc.entities.Vote.filter({ userId: user.id }, null, MAX_RECORDS),
    ]);

    const votedSuggestionIds = [...new Set(myVotes.map(v => v.suggestionId).filter(Boolean))];
    const votedSuggestions = votedSuggestionIds.length > 0
      ? await svc.entities.Suggestion.filter({ id: { $in: votedSuggestionIds } }, null, MAX_RECORDS)
      : [];

    const documentIds = [...new Set([
      ...interactions.map(i => i.documentId),
      ...mySuggestions.map(s => s.documentId),
      ...myCreatedDocs.map(d => d.id),
      ...votedSuggestions.map(s => s.documentId),
    ].filter(Boolean))].sort();

    if (documentIds.length === 0) {
      return Response.json({
        documents: [], mySuggestions: {}, myVotes: {}, unvoted: {}, contributors: {},
      });
    }

    // 2. Everything scoped to those documents.
    const [documents, suggestions, sections] = await Promise.all([
      svc.entities.Document.filter({ id: { $in: documentIds } }, null, MAX_RECORDS),
      svc.entities.Suggestion.filter({ documentId: { $in: documentIds } }, null, MAX_RECORDS),
      svc.entities.Section.filter({ documentId: { $in: documentIds } }, null, MAX_RECORDS),
    ]);

    const suggestionIds = suggestions.map(s => s.id);
    const sectionIds = sections.map(s => s.id);
    const rootIds = [...suggestionIds, ...sectionIds, ...documentIds];

    const [votes, sectionVotes, comments] = await Promise.all([
      suggestionIds.length > 0 ? svc.entities.Vote.filter({ suggestionId: { $in: suggestionIds } }, null, MAX_RECORDS) : [],
      sectionIds.length > 0 ? svc.entities.SectionVote.filter({ sectionId: { $in: sectionIds } }, null, MAX_RECORDS) : [],
      rootIds.length > 0 ? svc.entities.Comment.filter({ rootEntityId: { $in: rootIds } }, null, MAX_RECORDS) : [],
    ]);

    // 3. Only the profiles of people who appear in these documents. Service role
    // can read UserPublicProfile.email, so a person who both created a suggestion
    // and voted on one is counted once instead of twice.
    const participantIds = new Set();
    suggestions.forEach(s => { if (s.created_by_id) participantIds.add(s.created_by_id); });
    sections.forEach(s => { if (s.lastEditedBy) participantIds.add(s.lastEditedBy); });
    votes.forEach(v => { if (v.userId) participantIds.add(v.userId); });
    comments.forEach(c => { if (c.created_by_id) participantIds.add(c.created_by_id); });
    sectionVotes.forEach(v => { if (v.userId) participantIds.add(v.userId); });

    const profiles = participantIds.size > 0
      ? await svc.entities.UserPublicProfile.filter({ userId: { $in: [...participantIds] } }, null, MAX_RECORDS)
      : [];

    // 4. Per-document counters.
    const votedSet = new Set(votedSuggestionIds);
    const now = Date.now();
    const mySuggestionsByDoc: Record<string, number> = {};
    const myVotesByDoc: Record<string, number> = {};
    const unvotedByDoc: Record<string, number> = {};

    for (const s of suggestions) {
      if (s.created_by && s.created_by === user.email) {
        mySuggestionsByDoc[s.documentId] = (mySuggestionsByDoc[s.documentId] ?? 0) + 1;
      }
      if (votedSet.has(s.id)) {
        myVotesByDoc[s.documentId] = (myVotesByDoc[s.documentId] ?? 0) + 1;
      }
      if (
        s.status === 'pending' &&
        s.type !== 'edit_suggestion' &&
        s.created_by !== user.email &&
        (!s.timerEndsAt || new Date(s.timerEndsAt).getTime() > now) &&
        !votedSet.has(s.id)
      ) {
        unvotedByDoc[s.documentId] = (unvotedByDoc[s.documentId] ?? 0) + 1;
      }
    }

    // 5. Contributors per document (same rule as calculateContributorsByDocument:
    // a person identified by userId, or by email when no profile resolves).
    const emailToUserId = new Map();
    const emailByUserId = new Map();
    profiles.forEach(p => {
      if (!p.userId || !p.email) return;
      emailToUserId.set(p.email, p.userId);
      emailByUserId.set(p.userId, p.email);
    });

    const docIdBySuggestion = new Map();
    suggestions.forEach(s => { if (s.id && s.documentId) docIdBySuggestion.set(s.id, s.documentId); });
    const docIdBySection = new Map();
    sections.forEach(s => { if (s.id && s.documentId) docIdBySection.set(s.id, s.documentId); });

    const keysByDoc = new Map<string, Set<string>>();
    const addKey = (docId, key) => {
      if (!docId || !key) return;
      let set = keysByDoc.get(docId);
      if (!set) { set = new Set(); keysByDoc.set(docId, set); }
      set.add(key);
    };
    const resolveKey = (userId, email) =>
      userId || (email ? (emailToUserId.get(email) || email) : null);

    suggestions.forEach(s => addKey(s.documentId, resolveKey(s.created_by_id, s.created_by)));
    votes.forEach(v => addKey(docIdBySuggestion.get(v.suggestionId), resolveKey(v.userId, v.created_by)));
    comments.forEach(c => {
      const docId =
        c.rootEntityType === 'document' ? c.rootEntityId :
        c.rootEntityType === 'suggestion' ? docIdBySuggestion.get(c.rootEntityId) :
        c.rootEntityType === 'section' ? docIdBySection.get(c.rootEntityId) :
        null;
      addKey(docId, resolveKey(c.created_by_id, c.created_by));
    });
    sectionVotes.forEach(v => addKey(docIdBySection.get(v.sectionId), resolveKey(v.userId, v.created_by)));

    const contributorsByDoc: Record<string, number> = {};
    for (const doc of documents) {
      const set = keysByDoc.get(doc.id);
      if (!set) { contributorsByDoc[doc.id] = 1; continue; }
      for (const key of [...set]) {
        const email = emailByUserId.get(key);
        if (email && set.has(email)) set.delete(email);
      }
      contributorsByDoc[doc.id] = Math.max(1, set.size);
    }

    return Response.json({
      documents: documents.map(d => ({
        id: d.id,
        title: d.title,
        consensuses: d.consensuses ?? [],
        created_date: d.created_date,
      })),
      mySuggestions: mySuggestionsByDoc,
      myVotes: myVotesByDoc,
      unvoted: unvotedByDoc,
      contributors: contributorsByDoc,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}