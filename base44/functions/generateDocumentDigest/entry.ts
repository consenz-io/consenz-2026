import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const LANG_INSTRUCTIONS = {
  he: `ענה בעברית בלבד. שפה חיה, ישירה, נרטיבית. אל תשתמש בביטויים כלליים כמו "מגוון רחב" או "פעילות ענפה". התייחס לאנשים בשמותיהם. IMPORTANT: Keep all user names exactly as they appear in the data — do NOT translate or transliterate names (e.g. write "Anay Ben Pazi" not "אנת בן פזי"). השתמש בשפה נייטרלית מגדרית (כלומר: "כתב/ה", "הציע/ה").`,
  ar: `أجب بالعربية فقط. كن مباشراً وسردياً. IMPORTANT: Keep all user names exactly as they appear in the data — do NOT translate or transliterate names. استخدم لغة محايدة جندياً.`,
  en: `Answer in English only. Be direct, vivid, and narrative. IMPORTANT: Keep all user names exactly as they appear in the data — do NOT translate or transliterate names. Avoid generic phrases.`,
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { documentId, language } = await req.json();
    if (!documentId) return Response.json({ error: 'Missing documentId' }, { status: 400 });
    const lang = language || 'he';

    const [document, suggestions, allComments, allVotes, publicProfiles] = await Promise.all([
      base44.asServiceRole.entities.Document.filter({ id: documentId }).then(r => r[0]),
      base44.asServiceRole.entities.Suggestion.filter({ documentId }),
      base44.asServiceRole.entities.Comment.list(),
      base44.asServiceRole.entities.Vote.list(),
      base44.asServiceRole.entities.UserPublicProfile.list(),
    ]);

    if (!document) return Response.json({ error: 'Document not found' }, { status: 404 });

    // Filter comments/votes to this document's suggestions
    const suggestionIds = new Set(suggestions.map(s => s.id));
    const comments = allComments.filter(c =>
      (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) ||
      (c.rootEntityType === 'document' && c.rootEntityId === documentId)
    );
    const votes = allVotes.filter(v => suggestionIds.has(v.suggestionId));

    const profileMap = {};
    publicProfiles.forEach(p => { if (p.email) profileMap[p.email] = p.fullName || p.email?.split('@')[0] || 'משתמש'; });
    const getUserName = (email) => profileMap[email] || email?.split('@')[0] || 'משתמש';

    const acceptedSuggestions = suggestions.filter(s => s.status === 'accepted');
    const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

    const uniqueParticipants = new Set();
    suggestions.forEach(s => { if (s.created_by) uniqueParticipants.add(s.created_by); });
    comments.forEach(c => { if (c.created_by) uniqueParticipants.add(c.created_by); });
    votes.forEach(v => { if (v.created_by) uniqueParticipants.add(v.created_by); });

    const suggestionLines = suggestions.map(s => {
      const author = getUserName(s.created_by);
      const proVotes = s.proVotes || 0;
      const conVotes = s.conVotes || 0;
      const commentsOnSuggestion = comments
        .filter(c => c.rootEntityType === 'suggestion' && c.rootEntityId === s.id)
        .map(c => `    • ${getUserName(c.created_by)}: "${stripHtml(c.content).substring(0, 120)}"`)
        .join('\n');
      return `- [${s.status}] "${s.title}" by ${author} | ${proVotes} pro / ${conVotes} con | ID: ${s.id}\n${commentsOnSuggestion ? `  Comments:\n${commentsOnSuggestion}` : '  (no comments)'}`;
    }).join('\n\n');

    const allCommentLines = comments.slice(0, 50).map(c => {
      const author = getUserName(c.created_by);
      const snippet = stripHtml(c.content).substring(0, 150);
      const entityType = c.rootEntityType;
      const relatedSuggestion = entityType === 'suggestion' ? suggestions.find(s => s.id === c.rootEntityId) : null;
      const context = relatedSuggestion ? `on suggestion "${relatedSuggestion.title}"` : `on ${entityType}`;
      return `- ${author} (${context}): "${snippet}"`;
    }).join('\n');

    const prompt = `
You are writing an activity briefing for a new reader of the collaborative document titled: "${document.title}".

${LANG_INSTRUCTIONS[lang] || LANG_INSTRUCTIONS.en}

== SUGGESTIONS AND THEIR COMMENTS ==
${suggestionLines}

== ALL COMMENTS ==
${allCommentLines}

== STATS ==
- ${acceptedSuggestions.length} suggestions accepted, ${pendingSuggestions.length} pending
- ${comments.length} total comments, ${votes.length} total votes, ${uniqueParticipants.size} unique participants

Write 3-4 paragraphs that:

1. CONTENT FOCUS: Describe what the document is actually about and what specific changes have been proposed. Mention the accepted changes by name and describe what they changed. Do NOT just say "several changes were made" — describe the actual content.

2. WHO SAID WHAT: Name specific people and what they wrote. If multiple commenters expressed similar views or concerns, group them together and say "Both X and Y argued that...". Surface the most interesting or contested ideas.

3. COMMENTS AS POTENTIAL EDITS: Identify comments that contain substantive opinions or proposals (not just questions). Tell the reader: if these ideas resonate with them, they can turn them into edit suggestions and vote on them. Be specific — mention the comment content and who wrote it.

4. CALL TO ACTION: Name the pending suggestions by title and tell the reader concretely what they're about and why their vote matters. Make it personal and specific — e.g. "If you think X should be included, vote for [suggestion title]".

IMPORTANT:
- Never invent content. Only refer to what's in the data above.
- For each pending suggestion you mention by title, wrap it in the link tag.
- Keep it under 350 words total.
- Be warm and engaging, not bureaucratic.

Return JSON:
{
  "summary": "narrative HTML text. For each mentioned pending suggestion title, wrap it in: <a data-suggestion-id=\\"SUGGESTION_ID\\" class=\\"suggestion-link\\">TITLE</a>",
  "highlightedSuggestionIds": ["id1", "id2"]
}
`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          highlightedSuggestionIds: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    return Response.json(result || { summary: '', highlightedSuggestionIds: [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}