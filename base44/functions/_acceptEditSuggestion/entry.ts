import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Handles acceptance of an edit_suggestion suggestion.
 * Updates the parent suggestion's newContent, then triggers processAcceptance
 * on the parent if it is still pending.
 *
 * Input:  { suggestion, voterId, wasNewVote }
 * Output: { success: true }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { suggestion, voterId, wasNewVote } = await req.json();

    const detectLanguage = (text) => {
      if (!text) return 'he';
      if (/[\u0590-\u05FF]/.test(text)) return 'he';
      if (/[\u0600-\u06FF]/.test(text)) return 'ar';
      return 'en';
    };

    const parentSuggestion = await base44.asServiceRole.entities.Suggestion.get(suggestion.parentSuggestionId);
    if (!parentSuggestion) {
      console.warn('[ACCEPT EDIT SUGGESTION] Parent suggestion not found:', suggestion.parentSuggestionId);
      return Response.json({ success: true, message: 'Parent not found' });
    }

    const newContentLanguage = detectLanguage(suggestion.newContent || '');
    await base44.asServiceRole.entities.Suggestion.update(suggestion.parentSuggestionId, {
      newContent: suggestion.newContent,
      originalLanguage: newContentLanguage,
      translations: {}
    });

    // If parent is still pending, cascade its acceptance now
    if (parentSuggestion.status === 'pending') {
      try {
        await base44.asServiceRole.functions.invoke('processAcceptance', {
          suggestionId: suggestion.parentSuggestionId,
          documentId: suggestion.documentId,
          voterId,
          wasNewVote,
          forceAccept: true
        });
      } catch (parentErr) {
        console.error('[ACCEPT EDIT SUGGESTION] Failed to cascade parent acceptance:', parentErr);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});