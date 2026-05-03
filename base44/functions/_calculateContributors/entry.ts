import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Calculates the number of unique contributors for a document.
 * Contributors = unique emails across: suggestion creators, voters (via profile map),
 * comment authors, and document agreement signers.
 *
 * Input:  { documentId: string }
 * Output: { count: number }
 */

async function calculateContributors(base44, documentId) {
  const [suggestions, sections, agreements] = await Promise.all([
    base44.asServiceRole.entities.Suggestion.filter({ documentId }),
    base44.asServiceRole.entities.Section.filter({ documentId }),
    base44.asServiceRole.entities.DocumentAgreement.filter({ documentId })
  ]);

  const suggestionIds = suggestions.map(s => s.id);
  const sectionIds = sections.map(s => s.id);

  const [votes, profiles, docComments, sectionComments, suggestionComments] = await Promise.all([
    suggestionIds.length > 0
      ? base44.asServiceRole.entities.Vote.filter({ suggestionId: { $in: suggestionIds } })
      : Promise.resolve([]),
    base44.asServiceRole.entities.UserPublicProfile.list(),
    base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'document', rootEntityId: documentId }),
    sectionIds.length > 0
      ? base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'section', rootEntityId: { $in: sectionIds } })
      : Promise.resolve([]),
    suggestionIds.length > 0
      ? base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'suggestion', rootEntityId: { $in: suggestionIds } })
      : Promise.resolve([]),
  ]);

  const comments = [...docComments, ...sectionComments, ...suggestionComments];
  const profileByUserId = new Map(profiles.filter(p => p.userId).map(p => [p.userId, p]));

  const uniqueEmails = new Set();
  // Use created_by (platform-set email) as primary; fall back to profile lookup for older records
  votes.forEach(v => {
    if (v.created_by) {
      uniqueEmails.add(v.created_by);
    } else {
      const p = profileByUserId.get(v.userId);
      if (p?.email) uniqueEmails.add(p.email);
    }
  });
  comments.forEach(c => { if (c.created_by) uniqueEmails.add(c.created_by); });
  agreements.forEach(a => { if (a.userEmail) uniqueEmails.add(a.userEmail); });
  suggestions.forEach(s => { if (s.created_by) uniqueEmails.add(s.created_by); });

  return Math.max(1, uniqueEmails.size);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { documentId } = await req.json();
    if (!documentId) return Response.json({ error: 'Missing documentId' }, { status: 400 });
    const count = await calculateContributors(base44, documentId);
    return Response.json({ count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});