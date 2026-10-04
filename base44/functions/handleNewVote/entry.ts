import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { authorizeInternalOrUser } from '../../shared/authGate.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data: vote, args = {} } = body;

    // Authorization: this function performs service-role point mutations and is
    // only triggered by the platform workflow (entity-automation on Vote
    // create). Require either an admin session or the internal automation
    // token. Anonymous and regular authenticated callers are rejected —
    // previously any caller who referenced a real Vote ID could pass, and all
    // logic fields (suggestionId, userId, vote direction) were taken from the
    // forgeable request body, enabling unlimited point farming.
    const { ok, user, response } = await authorizeInternalOrUser(base44, body);
    if (!ok) return response;

    if (!vote || event?.type !== 'create') {
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    // Fetch the real Vote record server-side and use ITS fields for all logic.
    // Do NOT trust the request body's vote payload — it is client-supplied and
    // forgeable. The database record is the source of truth for suggestionId,
    // userId, and vote direction.
    const realVotes = await base44.asServiceRole.entities.Vote.filter({ id: vote.id });
    if (realVotes.length === 0) {
      console.log('[VOTE AUTOMATION] Vote not found:', vote.id);
      return Response.json({ message: 'Vote not found - skipping' }, { status: 200 });
    }
    const realVote = realVotes[0];

    console.log('[VOTE AUTOMATION] Processing new vote:', realVote.id, 'on suggestion:', realVote.suggestionId);

    // Fetch suggestion by the server-verified suggestionId
    const suggestions = await base44.asServiceRole.entities.Suggestion.filter({ id: realVote.suggestionId });
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

    // Skip if voter is the creator — use the server-verified userId
    if (realVote.userId === creator.id) {
      console.log('[VOTE AUTOMATION] Voter is creator, skipping');
      return Response.json({ message: 'Voter is creator' }, { status: 200 });
    }

    // Award points if gamification enabled and pro vote — use server-verified direction
    if (document.gamificationEnabled && realVote.vote === 'pro') {
      try {
        // Idempotency: key the award to the specific Vote record id so that
        // re-created votes (after a cancel/re-vote toggle) don't re-award
        // points. Each Vote row fires this automation exactly once.
        const existingTx = await base44.asServiceRole.entities.PointsTransaction.filter({
          relatedEntityId: realVote.id,
          action: 'vote_received'
        });
        if (existingTx.length > 0) {
          console.log('[VOTE AUTOMATION] Points already awarded for vote', realVote.id, '— skipping');
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
              relatedEntityId: realVote.id,
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
    return Response.json({ success: true, voteId: realVote.id });
  } catch (error) {
    console.error('[VOTE AUTOMATION] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});