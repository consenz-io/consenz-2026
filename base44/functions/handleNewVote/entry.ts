import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data: vote, args = {} } = body;
    // Auth: admin can call directly. Non-admin callers (including the workflow
    // engine, which has no user session) must reference a real Vote record —
    // this verifies the call is from a genuine entity-create trigger, not a
    // fabricated external request. The idempotency check (keyed on vote.id)
    // further prevents replay with real vote IDs.
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== 'admin') {
      if (!vote?.id || event?.type !== 'create') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const realVotes = await base44.asServiceRole.entities.Vote.filter({ id: vote.id });
      if (realVotes.length === 0) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

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
        // Idempotency: key the award to the specific Vote record id so that
        // re-created votes (after a cancel/re-vote toggle) don't re-award
        // points. Each Vote row fires this automation exactly once.
        const existingTx = await base44.asServiceRole.entities.PointsTransaction.filter({
          relatedEntityId: vote.id,
          action: 'vote_received'
        });
        if (existingTx.length > 0) {
          console.log('[VOTE AUTOMATION] Points already awarded for vote', vote.id, '— skipping');
        } else {
          await Promise.all([
            base44.asServiceRole.entities.User.update(creator.id, {
              points: (creator.points || 1000) + 10
            }),
            base44.asServiceRole.entities.PointsTransaction.create({
              userId: creator.id,
              amount: 10,
              action: 'vote_received',
              description: `Received a pro vote on suggestion: ${suggestion.title}`,
              relatedEntityId: vote.id,
              relatedEntityType: 'vote'
            })
          ]);
          console.log('[VOTE AUTOMATION] ✅ Awarded 10 points to creator');
        }
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