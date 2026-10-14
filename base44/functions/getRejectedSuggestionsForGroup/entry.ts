import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { verifyGroupMembership } from '../../shared/documentAuth.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const svc = base44.asServiceRole;

    // Find the group by name
    const groups = await svc.entities.Group.filter({ name: 'בי״ס דמוקרטי לב השרון' });
    if (groups.length === 0) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }
    const group = groups[0];
    const groupId = group.id;

    // Authorization: private/hidden groups require verified membership.
    // Without this check, any authenticated user could read the full
    // rejected-suggestion dump (documents, suggestions, user profiles) of
    // a group they have no access to.
    if (group.status === 'private' || group.status === 'hidden') {
      const { isMember } = await verifyGroupMembership(base44, group, user);
      if (!isMember) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Find all documents in this group
    const documents = await svc.entities.Document.filter({ groupId });
    if (documents.length === 0) {
      return Response.json({ suggestions: [], documents: [] });
    }

    const documentIds = documents.map(d => d.id);

    // Find all rejected suggestions in these documents
    const rejectedSuggestions = await svc.entities.Suggestion.filter({
      documentId: { $in: documentIds },
      status: 'rejected'
    });

    // Fetch related user profiles for creator info — only for users who
    // actually created a rejected suggestion, not the entire profile table.
    const creatorEmails = [...new Set(rejectedSuggestions.map(s => s.created_by).filter(Boolean))];
    const userProfiles = creatorEmails.length > 0
      ? await svc.entities.UserPublicProfile.filter({ email: { $in: creatorEmails } })
      : [];

    return Response.json({
      groupId,
      groupName: group.name,
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