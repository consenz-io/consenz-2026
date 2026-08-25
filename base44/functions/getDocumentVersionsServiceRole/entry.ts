import { createClientFromRequest } from 'npm:@base44/sdk@0.8.27';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate the caller — this endpoint uses asServiceRole to bypass RLS,
    // so we must manually verify the user is allowed to see this document.
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { documentId } = payload;

    if (!documentId) {
      return Response.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Fetch the document to check group-based access
    const docs = await base44.asServiceRole.entities.Document.filter({ id: documentId });
    if (docs.length === 0) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }
    const document = docs[0];

    // If the document belongs to a private/hidden group, verify membership
    if (document.groupId) {
      const groups = await base44.asServiceRole.entities.Group.filter({ id: document.groupId });
      if (groups.length > 0) {
        const group = groups[0];
        if (group.status === 'private' || group.status === 'hidden') {
          const memberships = await base44.asServiceRole.entities.GroupMember.filter({
            groupId: document.groupId,
            userId: user.id
          });
          if (memberships.length === 0) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
          }
        }
      }
    }

    // Access verified — fetch version history using service role
    const versions = await base44.asServiceRole.entities.DocumentVersion.filter(
      { documentId }
    );

    return Response.json({ data: versions });
  } catch (error) {
    console.error('Error fetching document versions:', error);
    console.error('Error data:', JSON.stringify(error.data));
    return Response.json({ error: error.message, detail: error.data }, { status: 500 });
  }
});