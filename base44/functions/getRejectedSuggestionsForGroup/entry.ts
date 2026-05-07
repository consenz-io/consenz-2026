import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the group by name
    const groups = await base44.entities.Group.filter({ name: 'בי״ס דמוקרטי לב השרון' });
    if (groups.length === 0) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }
    const groupId = groups[0].id;

    // Find all documents in this group
    const documents = await base44.entities.Document.filter({ groupId });
    if (documents.length === 0) {
      return Response.json({ suggestions: [], documents: [] });
    }

    const documentIds = documents.map(d => d.id);

    // Find all rejected suggestions in these documents
    const rejectedSuggestions = await base44.entities.Suggestion.filter({
      documentId: { $in: documentIds },
      status: 'rejected'
    });

    // Optionally, fetch related user profiles for creator info
    const creatorEmails = [...new Set(rejectedSuggestions.map(s => s.created_by).filter(Boolean))];
    const userProfiles = creatorEmails.length > 0
      ? await base44.entities.UserPublicProfile.filter({})
      : [];

    return Response.json({
      groupId,
      groupName: groups[0].name,
      documentCount: documents.length,
      rejectedSuggestionsCount: rejectedSuggestions.length,
      documents,
      suggestions: rejectedSuggestions,
      userProfiles,
    });
  } catch (error) {
    console.error('Error fetching rejected suggestions:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});