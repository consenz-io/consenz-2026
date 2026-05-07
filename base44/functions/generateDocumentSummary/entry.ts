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
  const [document, topics, sections, suggestions, allVotes, allComments, publicProfiles, documentVersions, allArguments] = await Promise.all([
    base44.asServiceRole.entities.Document.filter({ id: documentId }).then(r => r[0]),
    base44.asServiceRole.entities.Topic.filter({ documentId }),
    base44.asServiceRole.entities.Section.filter({ documentId }),
    base44.asServiceRole.entities.Suggestion.filter({ documentId }),
    base44.asServiceRole.entities.Vote.list(),
    base44.asServiceRole.entities.Comment.list(),
    base44.asServiceRole.entities.UserPublicProfile.list(),
    base44.asServiceRole.entities.DocumentVersion.filter({ documentId }),
    base44.asServiceRole.entities.Argument.list(),
  ]);

  if (!document) return Response.json({ error: 'Document not found' }, { status: 404 });

  // Build lookup: email -> displayName (created_by is email)
  const profileMap = {};
  publicProfiles.forEach(p => { if (p.email) profileMap[p.email] = p.fullName || p.email || 'משתמש'; });

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

  // Filter arguments relevant to this document's suggestions
  const relevantArguments = allArguments.filter(a => suggestionIds.has(a.suggestionId));

  // Helper: strip HTML tags for plain text
  const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // Helper: format suggestion line with HTML link
  const fmtSuggestion = (s) => {
    const votes = `👍 ${s.proVotes || 0} / 👎 ${s.conVotes || 0}`;
    const author = s.created_by ? (profileMap[s.created_by] || s.created_by) : '?';
    const url = suggestionUrl(s.id);
    return `"${s.title}" — ${votes} — מאת: ${author} — <a href="${url}" style="color:#2563eb;text-decoration:underline;">לצפייה והצבעה</a>`;
  };

  // Helper: format comments for a given entity
  const fmtComments = (entityType, entityId) => {
    const comments = relevantComments.filter(c => c.rootEntityType === entityType && c.rootEntityId === entityId);
    if (comments.length === 0) return '';
    return comments.map(c => {
      const author = c.created_by ? (profileMap[c.created_by] || c.created_by.split('@')[0]) : '?';
      return `    [תגובה מאת ${author}]: "${stripHtml(c.content)}"`;
    }).join('\n');
  };

  // Helper: format arguments for a suggestion
  const fmtArguments = (suggestionId) => {
    const args = relevantArguments.filter(a => a.suggestionId === suggestionId);
    if (args.length === 0) return '';
    return args.map(a => {
      const author = a.created_by ? (profileMap[a.created_by] || a.created_by.split('@')[0]) : '?';
      return `    [טיעון ${a.type === 'pro' ? 'בעד' : 'נגד'} מאת ${author}]: "${stripHtml(a.content)}"`;
    }).join('\n');
  };

  // Helper: format full suggestion block with its arguments and comments
  const fmtSuggestionFull = (s) => {
    const base = fmtSuggestion(s);
    const explanation = s.explanation ? `\n    הסבר: "${stripHtml(s.explanation)}"` : '';
    const args = fmtArguments(s.id);
    const comments = fmtComments('suggestion', s.id);
    return base + explanation + (args ? '\n' + args : '') + (comments ? '\n' + comments : '');
  };

  const langLabel = language === 'he' ? 'Hebrew' : language === 'ar' ? 'Arabic' : 'English';

  // Build section content with their comments
  const fmtSections = sections.map(sec => {
    const topic = topics.find(t => t.id === sec.topicId);
    const topicTitle = topic ? topic.title : '?';
    const comments = fmtComments('section', sec.id);
    return `  [נושא: ${topicTitle}] "${stripHtml(sec.content).substring(0, 300)}${stripHtml(sec.content).length > 300 ? '...' : ''}"` +
      (comments ? '\n' + comments : '');
  }).join('\n');

  // Document-level comments
  const docComments = relevantComments.filter(c => c.rootEntityType === 'document' && c.rootEntityId === documentId);
  const fmtDocComments = docComments.map(c => {
    const author = c.created_by ? (profileMap[c.created_by] || c.created_by.split('@')[0]) : '?';
    return `  [תגובה מאת ${author}]: "${stripHtml(c.content)}"`;
  }).join('\n');

  const prompt = `You are writing a professional activity summary for a collaborative document platform called Consenz.
Write the summary in ${langLabel}. The summary will be sent as an HTML email to all document participants.

=== DOCUMENT OVERVIEW ===
Title: "${document.title}"
Topics: ${topics.map(t => t.title).join(' | ') || 'None'}
Document URL: ${docUrl}

=== DOCUMENT CONTENT (sections with user comments) ===
${fmtSections || '(no sections yet)'}

${fmtDocComments ? `=== GENERAL DOCUMENT DISCUSSION ===\n${fmtDocComments}` : ''}

=== CONTENT ORIGIN (important distinction) ===
Sections written by admin during document creation (baseline content, NOT user contributions): ${adminCreatedSections.length} sections
Sections that exist because a user suggestion was accepted (real user contributions): ${userContributedSections.length} sections

=== SUGGESTIONS (with arguments and comments) ===
Accepted by community consensus (${acceptedByConsensus.length}):
${acceptedByConsensus.map(s => `  • ${fmtSuggestionFull(s)}`).join('\n') || '  (none)'}

Accepted by admin override — bypassed consensus (${acceptedByAdmin.length}):
${acceptedByAdmin.map(s => `  • ${fmtSuggestionFull(s)}`).join('\n') || '  (none)'}

=== ENGAGEMENT ===
Unique participants: ${participantEmails.size}
Total votes cast: ${relevantVotes.length}
Total comments: ${relevantComments.length}
Total arguments: ${relevantArguments.length}

${additionalInstructions ? `=== ADMIN INSTRUCTIONS ===\n${additionalInstructions}` : ''}

=== WRITING INSTRUCTIONS ===
Write a clear, warm, and professional activity summary email body.

IMPORTANT: Start the email with this disclaimer at the very top:
<p style="font-size: 12px; color: #999; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px;">
  <strong>הערה:</strong> מייל זה נוצר באמצעות בינה מלאכותית ועשוי להכיל שגיאות או פרשנויות שגויות של מונחים ותכנים.
</p>

Structure:
1. Short greeting mentioning the document name
2. Distinguish clearly between the admin-written baseline content and genuine user contributions. Celebrate user contributions.
3. Summarize key discussion points and arguments raised by the community (from comments and arguments above).

5. Brief engagement stats
6. Encouraging closing note with link to the document

IMPORTANT:
- Output valid HTML only (no markdown). Use <p>, <ul>, <li>, <strong>, <a href="..."> tags.
- When mentioning open suggestions, embed them as clickable HTML links using the <a> tags already provided in the data above — do NOT strip or replace the HTML link tags.
- Be honest about which content came from admins vs. the community.
- Use the actual content of comments and arguments to give meaningful insights, not just counts.
- Keep it under 600 words.

DISCLAIMER SECTION (must appear at the bottom of the email):
Add a clearly separated disclaimer paragraph styled with small gray text, stating that:
1. This summary was generated automatically by an AI system and may contain errors or misinterpretations of terminology.
2. The Consenz platform has recently introduced UI improvements including: a unified voting progress bar that visually shows how close each suggestion is to the acceptance threshold, hover effects that preview the impact of your vote before you click, and clearer distinction between suggestions accepted by community consensus vs. admin override.`;

  const summary = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    model: 'claude_sonnet_4_6',
    add_context_from_internet: false,
  });

  // Strip markdown code fences if LLM wrapped the HTML in ```html ... ```
  let summaryText = typeof summary === 'string' ? summary : summary?.content || String(summary);
  summaryText = summaryText.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  return Response.json({
   summary: summaryText,
   stats: {
     participants: participantEmails.size,
     totalSuggestions: suggestions.length,
     accepted: acceptedByConsensus.length + acceptedByAdmin.length,
     pending: pending.length,
     rejected: rejected.length,
     votes: relevantVotes.length,
     comments: relevantComments.length,
   },
  });
});