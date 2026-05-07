import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId, additionalInstructions } = await req.json();

    if (!documentId) {
      return Response.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Verify user is admin of this document
    const adminRecords = await base44.asServiceRole.entities.DocumentAdmin.filter({ documentId, userId: user.id });
    if (adminRecords.length === 0 && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Document admin access required' }, { status: 403 });
    }

    // Fetch all relevant data
    const [document, suggestions, sections, topics, agreements] = await Promise.all([
      base44.asServiceRole.entities.Document.filter({ id: documentId }).then(d => d[0]),
      base44.asServiceRole.entities.Suggestion.filter({ documentId }),
      base44.asServiceRole.entities.Section.filter({ documentId }),
      base44.asServiceRole.entities.Topic.filter({ documentId }),
      base44.asServiceRole.entities.DocumentAgreement.filter({ documentId }),
    ]);

    if (!document) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    // Fetch comments and votes filtered by document after we know the suggestion/section IDs
    const suggestionIds = new Set(suggestions.map(s => s.id));
    const sectionIds = new Set(sections.map(s => s.id));

    // Fetch votes per suggestion (only for pending/accepted to estimate engagement)
    const voteCount = suggestions.reduce((sum, s) => sum + (s.proVotes || 0) + (s.conVotes || 0), 0);

    // Fetch document-level comments only (avoids loading all comments in the system)
    const [docComments] = await Promise.all([
      base44.asServiceRole.entities.Comment.filter({ rootEntityType: 'document', rootEntityId: documentId }),
    ]);

    const relevantComments = docComments;
    const relevantVotes = { length: voteCount };

    // Categorize suggestions
    const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
    const acceptedSuggestions = suggestions.filter(s => s.status === 'accepted');
    const rejectedSuggestions = suggestions.filter(s => s.status === 'rejected');

    // Build unique participants set
    const participantEmails = new Set();
    suggestions.forEach(s => { if (s.created_by) participantEmails.add(s.created_by); });
    relevantComments.forEach(c => { if (c.created_by) participantEmails.add(c.created_by); });
    agreements.forEach(a => { if (a.userEmail) participantEmails.add(a.userEmail); });

    const topicsMap = {};
    topics.forEach(t => { topicsMap[t.id] = t.title; });

    // Build rich prompt
    const promptData = {
      documentTitle: document.title,
      documentDescription: document.description ? document.description.replace(/<[^>]*>/g, '') : '',
      totalTopics: topics.length,
      totalSections: sections.length,
      totalParticipants: participantEmails.size,
      totalAgreements: agreements.length,
      suggestions: {
        total: suggestions.length,
        pending: pendingSuggestions.length,
        accepted: acceptedSuggestions.length,
        rejected: rejectedSuggestions.length,
      },
      pendingSuggestionsList: pendingSuggestions.slice(0, 10).map(s => ({
        title: s.title,
        type: s.type,
        proVotes: s.proVotes || 0,
        conVotes: s.conVotes || 0,
        topic: topicsMap[s.topicId] || '',
        createdAt: s.created_date,
        timerEndsAt: s.timerEndsAt,
      })),
      acceptedSuggestionsList: acceptedSuggestions.slice(0, 10).map(s => ({
        title: s.title,
        type: s.type,
        topic: topicsMap[s.topicId] || '',
        consensus: s.suggestionConsensus,
        acceptedAt: s.updated_date,
      })),
      totalComments: relevantComments.length,
      totalVotes: relevantVotes.length || voteCount,
    };

    const lang = document.originalLanguage || 'he';
    const langInstruction = lang === 'he'
      ? 'Write the summary in Hebrew (עברית).'
      : lang === 'ar'
      ? 'Write the summary in Arabic (العربية).'
      : 'Write the summary in English.';

    const prompt = `You are creating a document activity summary for administrators and participants of a collaborative document platform.

${langInstruction}

Document: "${promptData.documentTitle}"
${promptData.documentDescription ? `Description: ${promptData.documentDescription}` : ''}

DOCUMENT STRUCTURE:
- Topics: ${promptData.totalTopics}
- Sections: ${promptData.totalSections}
- Total participants: ${promptData.totalParticipants}
- Document agreements signed: ${promptData.totalAgreements}

SUGGESTIONS ACTIVITY:
- Total suggestions: ${promptData.suggestions.total}
- ✅ Accepted: ${promptData.suggestions.accepted}
- ⏳ Pending (open for voting): ${promptData.suggestions.pending}
- ❌ Rejected: ${promptData.suggestions.rejected}

${promptData.pendingSuggestionsList.length > 0 ? `OPEN SUGGESTIONS (awaiting votes):
${promptData.pendingSuggestionsList.map(s => `  • "${s.title}" [${s.proVotes} for / ${s.conVotes} against]${s.topic ? ` — topic: ${s.topic}` : ''}`).join('\n')}` : ''}

${promptData.acceptedSuggestionsList.length > 0 ? `RECENTLY ACCEPTED SUGGESTIONS:
${promptData.acceptedSuggestionsList.map(s => `  • "${s.title}"${s.topic ? ` — topic: ${s.topic}` : ''}${s.consensus ? ` (consensus: ${Math.round(s.consensus * 100)}%)` : ''}`).join('\n')}` : ''}

ENGAGEMENT:
- Total votes cast: ${promptData.totalVotes}
- Total comments: ${promptData.totalComments}

${additionalInstructions ? `ADDITIONAL INSTRUCTIONS FROM ADMIN: ${additionalInstructions}` : ''}

Write a friendly, clear, and engaging activity summary email for document participants. Include:
1. A brief welcome/intro
2. Summary of what has been decided (accepted suggestions)
3. What is still open for voting (pending suggestions) with a clear call to action
4. General engagement statistics
5. An encouraging closing

Format it as an HTML email body (use <h2>, <p>, <ul>, <li>, <strong> tags). Make it look professional and readable.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
      add_context_from_internet: false,
    });

    const summary = typeof result === 'string' ? result : result.content || JSON.stringify(result);

    return Response.json({
      summary,
      participantCount: participantEmails.size,
      participantEmails: [...participantEmails],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});