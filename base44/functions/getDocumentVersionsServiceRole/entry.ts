import { createClientFromRequest } from 'npm:@base44/sdk@0.8.27';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { documentId } = payload;

    if (!documentId) {
      return Response.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Use asServiceRole to bypass all RLS checks - works without user auth
    const versions = await base44.asServiceRole.entities.DocumentVersion.filter(
      { documentId },
      'version',
      500
    );

    return Response.json({ data: versions });
  } catch (error) {
    console.error('Error fetching document versions:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});