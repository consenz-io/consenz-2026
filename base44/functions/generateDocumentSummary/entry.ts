import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { documentId, additionalInstructions, language, appBaseUrl } = await req.json();
  if (!documentId) return Response.json({ error: 'Missing documentId' }, { status: 400 });

  // Verify user is document admin or system admin
  const adminRecords = await base44.asServiceRole.entities.DocumentAdmin.filter({ documentId, userId: user.id });
  if (adminRecords.length === 0 && user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all relevant data in parallel
  const [document, topics, sections, suggestions, allVotes, allComments, publicProfiles, documentVersions] = await Promise.all([
    base44.asServiceRole.entities.Document.filter({ id: documentId }).then(r => r[0]),
    base44.asServiceRole.entities.Topic.filter({ documentId }),
    base44.asServiceRole.entities.Section.filter({ documentId }),
    base44.asServiceRole.entities.Suggestion.filter({ documentId }),
    base44.asServiceRole.entities.Vote.list(),
    base44.asServiceRole.entities.Comment.list(),
    base44.asServiceRole.entities.UserPublicProfile.list(),
    base44.asServiceRole.entities.DocumentVersion.filter({ documentId }),
  ]);

  if (!document) return Response.json({ error: 'Document not found' }, { status: 404 });

  // Build lookup: userId -> displayName
  const profileMap = {};
  publicProfiles.forEach(p => { if (p.userId) profileMap[p.userId] = p.fullName || p.email || 'משתמש'; });

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

  // --- Distinguish content origin ---
  // Sections created by admin directly (via direct_edit or section_created version, NOT via accepted suggestion)
  const sectionCreatedByAcceptance = new Set(
    documentVersions
      .filter(v => v.changeType === 'suggestion_accepted')
      .map(v => v.sectionId)
  );
  const adminCreatedSections = sections.filter(s => !sectionCreatedByAcceptance.has(s.id));
  const userContributedSections = sections.filter(s => sectionCreatedByAcceptance.has(s.id));

  // Suggestions categorised
  const acceptedByConsensus = suggestions.filter(s => s.status === 'accepted' && !s.approvedByAdmin);
  const acceptedByAdmin = suggestions.filter(s => s.status === 'accepted' && s.approvedByAdmin);
  const pending = suggestions.filter(s => s.status === 'pending');
  const rejected = suggestions.filter(s => s.status === 'rejected');

  // Build base URL for links
  const baseUrl = appBaseUrl || 'https://app.base44.com';
  const suggestionUrl = (id) => `${baseUrl}/SuggestionDetail?id=${id}`;
  const docUrl = `${baseUrl}/DocumentView?id=${documentId}`;

  // Helper: format suggestion line with HTML link
  const fmtSuggestion = (s) => {
    const votes = `👍 ${s.proVotes || 0} / 👎 ${s.conVotes || 0}`;
    const author = s.created_by ? (profileMap[s.created_by] || s.created_by) : '?';
    const url = suggestionUrl(s.id);
    return `"${s.title}" — ${votes} — מאת: ${author} — <a href="${url}" style="color:#2563eb;text-decoration:underline;">לצפייה והצבעה</a>`;
  };

  const langLabel = language === 'he' ? 'Hebrew' : language === 'ar' ? 'Arabic' : 'English';

  const prompt = `You are writing a professional activity summary for a collaborative document platform called Consenz.
Write the summary in ${langLabel}. The summary will be sent as an HTML email to all document participants.

=== DOCUMENT OVERVIEW ===
Title: "${document.title}"
Topics: ${topics.map(t => t.title).join(' | ') || 'None'}
Document URL: ${docUrl}

=== CONTENT ORIGIN (important distinction) ===
Sections written by admin during document creation (baseline content, NOT user contributions): ${adminCreatedSections.length} sections
Sections that exist because a user suggestion was accepted (real user contributions): ${userContributedSections.length} sections

=== SUGGESTIONS ===
Accepted by community consensus (${acceptedByConsensus.length}):
${acceptedByConsensus.map(s => `  • ${fmtSuggestion(s)}`).join('\n') || '  (none)'}

Accepted by admin override — bypassed consensus (${acceptedByAdmin.length}):
${acceptedByAdmin.map(s => `  • ${fmtSuggestion(s)}`).join('\n') || '  (none)'}

Currently open for voting — readers should click and vote (${pending.length}):
${pending.map(s => `  • ${fmtSuggestion(s)}`).join('\n') || '  (none)'}

Rejected (${rejected.length}):
${rejected.map(s => `  • "${s.title}"`).join('\n') || '  (none)'}

=== ENGAGEMENT ===
Unique participants: ${participantEmails.size}
Total votes cast: ${relevantVotes.length}
Total comments: ${relevantComments.length}

${additionalInstructions ? `=== ADMIN INSTRUCTIONS ===\n${additionalInstructions}` : ''}

=== WRITING INSTRUCTIONS ===
Write a clear, warm, and professional activity summary email body.
Structure:
1. Short greeting mentioning the document name
2. Distinguish clearly between the admin-written baseline content and genuine user contributions (suggestions that passed consensus). Celebrate user contributions.
3. Highlight open suggestions with their direct links so readers can click and vote easily
4. Brief engagement stats
5. Encouraging closing note with link to the document

IMPORTANT:
- Output valid HTML only (no markdown). Use <p>, <ul>, <li>, <strong>, <a href="..."> tags.
- When mentioning open suggestions, embed them as clickable HTML links using the <a> tags already provided in the data above — do NOT strip or replace the HTML link tags.
- Be honest about which content came from admins vs. the community.
- Keep it under 450 words.`;

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
      accepted: acceptedByConsensus.length + acceptedByAdmin.length,
      pending: pending.length,
      rejected: rejected.length,
      votes: relevantVotes.length,
      comments: relevantComments.length,
    },
    pendingSuggestions: pending.map(s => ({ id: s.id, title: s.title, proVotes: s.proVotes || 0, conVotes: s.conVotes || 0, url: suggestionUrl(s.id) })),
  });
});