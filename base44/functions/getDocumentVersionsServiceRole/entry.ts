import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { documentId } = payload;

    if (!documentId) {
      return Response.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Use service role to bypass RLS restrictions on DocumentVersion
    const versions = await base44.asServiceRole.entities.DocumentVersion.filter(
      { documentId },
      '-version'
    );

    return Response.json({ data: versions });
  } catch (error) {
    console.error('Error fetching document versions:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});