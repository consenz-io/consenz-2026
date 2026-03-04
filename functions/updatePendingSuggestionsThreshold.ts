import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { documentId } = await req.json();

    if (!documentId) {
      return Response.json({ error: 'documentId required' }, { status: 400 });
    }

    // Fetch document and pending suggestions
    const [document, pendingSuggestions] = await Promise.all([
      base44.asServiceRole.entities.Document.get(documentId),
      base44.asServiceRole.entities.Suggestion.filter({ documentId, status: 'pending' })
    ]);

    if (!document) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    const currentThreshold = document.threshold || 2;
    
    if (pendingSuggestions.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No pending suggestions to update',
        updated: 0
      });
    }

    // Update all pending suggestions with current document threshold
    const updates = pendingSuggestions.map(s => 
      base44.asServiceRole.entities.Suggestion.update(s.id, { threshold: currentThreshold })
    );

    await Promise.all(updates);

    console.log(`[UPDATE THRESHOLD] Updated ${pendingSuggestions.length} pending suggestions in document ${documentId} to threshold ${currentThreshold}`);

    return Response.json({
      success: true,
      updated: pendingSuggestions.length,
      threshold: currentThreshold
    });

  } catch (error) {
    console.error('[UPDATE THRESHOLD ERROR]', error);
    return Response.json({ 
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});