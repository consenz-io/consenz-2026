import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { documentId, additionalInstructions, language } = await req.json();
  if (!documentId) return Response.json({ error: 'Missing documentId' }, { status: 400 });

  // Verify user is document admin or system admin
  const adminRecords = await base44.asServiceRole.entities.DocumentAdmin.filter({ documentId, userId: user.id });
  if (adminRecords.length === 0 && user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all relevant data
  const [document, topics, sections, suggestions, allVotes, allComments, publicProfiles] = await Promise.all([
    base44.asServiceRole.entities.Document.filter({ id: documentId }).then(r => r[0]),
    base44.asServiceRole.entities.Topic.filter({ documentId }),
    base44.asServiceRole.entities.Section.filter({ documentId }),
    base44.asServiceRole.entities.Suggestion.filter({ documentId }),
    base44.asServiceRole.entities.Vote.list(),
    base44.asServiceRole.entities.Comment.list(),
    base44.asServiceRole.entities.UserPublicProfile.list(),
  ]);

  if (!document) return Response.json({ error: 'Document not found' }, { status: 404 });

  // Filter votes/comments relevant to this document
  const suggestionIds = new Set(suggestions.map(s => s.id));
  const sectionIds = new Set(sections.map(s => s.id));
  const relevantVotes = allVotes.filter(v => suggestionIds.has(v.suggestionId));
  const relevantComments = allComments.filter(c =>
    (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) ||
    (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) ||
    (c.rootEntityType === 'document' && c.rootEntityId === documentId)
  );

  // Build unique participants set
  const participantEmails = new Set();
  relevantVotes.forEach(v => { if (v.created_by) participantEmails.add(v.created_by); });
  relevantComments.forEach(c => { if (c.created_by) participantEmails.add(c.created_by); });
  suggestions.forEach(s => { if (s.created_by) participantEmails.add(s.created_by); });

  const accepted = suggestions.filter(s => s.status === 'accepted' && !s.approvedByAdmin);
  const pending = suggestions.filter(s => s.status === 'pending');
  const rejected = suggestions.filter(s => s.status === 'rejected');
  const adminApproved = suggestions.filter(s => s.approvedByAdmin);

  // Determine language labels
  const isHe = language === 'he';
  const isAr = language === 'ar';

  const langLabel = isHe ? 'Hebrew' : isAr ? 'Arabic' : 'English';
  const isRTL = isHe || isAr;

  // Build structured prompt
  const prompt = `You are writing a professional activity summary for a collaborative document platform called Consenz.
Write the summary in ${langLabel}. The summary will be sent as an email to all document participants.

Document: "${document.title}"
Topics: ${topics.map(t => t.title).join(', ') || 'None'}
Total sections: ${sections.length}
Total participants: ${participantEmails.size}
Total votes cast: ${relevantVotes.length}
Total comments: ${relevantComments.length}

Suggestions breakdown:
- Accepted by consensus (${accepted.length}): ${accepted.map(s => `"${s.title}"`).join(', ') || 'None'}
- Accepted by admin override (${adminApproved.length}): ${adminApproved.map(s => `"${s.title}"`).join(', ') || 'None'}
- Currently open for voting (${pending.length}): ${pending.map(s => `"${s.title}" (👍 ${s.proVotes || 0} / 👎 ${s.conVotes || 0})`).join(', ') || 'None'}
- Rejected (${rejected.length}): ${rejected.map(s => `"${s.title}"`).join(', ') || 'None'}

${additionalInstructions ? `Additional instructions from admin: ${additionalInstructions}` : ''}

Write a clear, warm, and professional activity summary.
Structure it with the following sections:
1. A short greeting / intro paragraph (mention the document name and period of activity)
2. Key highlights (accepted suggestions and their impact)
3. Currently open suggestions requiring votes
4. Overall participation and engagement stats
5. A closing encouragement to continue participating

Keep it concise (under 400 words). Use a friendly but professional tone.
Do NOT include any HTML, markdown, or formatting tags — plain text only.`;

  const summary = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    model: 'claude_sonnet_4_6',
    add_context_from_internet: false,
  });

  return Response.json({
    summary: typeof summary === 'string' ? summary : summary?.content || String(summary),
    stats: {
      participants: participantEmails.size,
      totalSuggestions: suggestions.length,
      accepted: accepted.length + adminApproved.length,
      pending: pending.length,
      rejected: rejected.length,
      votes: relevantVotes.length,
      comments: relevantComments.length,
    }
  });
});