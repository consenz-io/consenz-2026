import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: vote } = await req.json();

    if (!vote || event.type !== 'create') {
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    console.log('[VOTE AUTOMATION] Processing new vote:', vote.id, 'on suggestion:', vote.suggestionId);

    // Fetch suggestion by specific ID
    const suggestions = await base44.asServiceRole.entities.Suggestion.filter({ id: vote.suggestionId });
    const suggestion = suggestions[0];
    if (!suggestion) {
      console.log('[VOTE AUTOMATION] Suggestion not found (may have been deleted):', vote.suggestionId);
      return Response.json({ message: 'Suggestion not found - skipping' }, { status: 200 });
    }

    // Fetch document and creator in parallel by specific IDs
    const [documents, creatorUsers] = await Promise.all([
      base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }),
      base44.asServiceRole.entities.User.filter({ id: suggestion.created_by_id }),
    ]);

    const document = documents[0];
    const creator = creatorUsers[0];

    if (!document) {
      console.log('[VOTE AUTOMATION] Document not found:', suggestion.documentId);
      return Response.json({ message: 'Document not found - skipping' }, { status: 200 });
    }
    if (!creator) {
      console.log('[VOTE AUTOMATION] Creator not found:', suggestion.created_by);
      return Response.json({ message: 'Creator not found - skipping' }, { status: 200 });
    }

    // Skip if voter is the creator
    if (vote.userId === creator.id) {
      console.log('[VOTE AUTOMATION] Voter is creator, skipping');
      return Response.json({ message: 'Voter is creator' }, { status: 200 });
    }

    // Award points if gamification enabled and pro vote
    if (document.gamificationEnabled && vote.vote === 'pro') {
      try {
        await Promise.all([
          base44.asServiceRole.entities.User.update(creator.id, {
            points: (creator.points || 1000) + 10
          }),
          base44.asServiceRole.entities.PointsTransaction.create({
            userId: creator.id,
            amount: 10,
            action: 'vote_received',
            description: `Received a pro vote on suggestion: ${suggestion.title}`,
            relatedEntityId: suggestion.id,
            relatedEntityType: 'suggestion'
          })
        ]);
        console.log('[VOTE AUTOMATION] ✅ Awarded 10 points to creator');
      } catch (pointsError) {
        console.error('[VOTE AUTOMATION] Points error (non-critical):', pointsError.message);
      }
    }

    console.log('[VOTE AUTOMATION] ✅ Done');
    return Response.json({ success: true, voteId: vote.id });
  } catch (error) {
    console.error('[VOTE AUTOMATION] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});