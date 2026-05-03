import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// In-memory lock to prevent the same user voting on the same section concurrently
const processingVotes = new Set();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sectionId, vote } = await req.json();

    if (!sectionId || !vote) {
      return Response.json({ error: 'Missing sectionId or vote' }, { status: 400 });
    }

    if (vote !== 'pro' && vote !== 'con') {
      return Response.json({ error: 'Invalid vote value' }, { status: 400 });
    }

    // Idempotency lock — prevent duplicate concurrent requests for same user+section
    const lockKey = `${user.id}-${sectionId}`;
    if (processingVotes.has(lockKey)) {
      return Response.json({ error: 'Vote already in progress' }, { status: 429 });
    }
    processingVotes.add(lockKey);
    // Safety net: always release lock
    setTimeout(() => processingVotes.delete(lockKey), 10000);

    try {
      // Fetch existing votes for this section
      const existingVotes = await base44.entities.SectionVote.filter({ sectionId });
      const existingVote = existingVotes.find(v => v.userId === user.id) || null;

      let action;
      if (existingVote) {
        if (existingVote.vote === vote) {
          // Toggle off — same vote clicked again
          await base44.entities.SectionVote.delete(existingVote.id);
          action = 'deleted';
        } else {
          // Change vote direction
          await base44.entities.SectionVote.update(existingVote.id, { vote });
          action = 'updated';
        }
      } else {
        // New vote — check again for race condition (double-check before create)
        const doubleCheck = await base44.entities.SectionVote.filter({ sectionId, userId: user.id });
        if (doubleCheck.length > 0) {
          // Another request already created the vote — update it instead
          await base44.entities.SectionVote.update(doubleCheck[0].id, { vote });
          action = 'updated';
        } else {
          await base44.entities.SectionVote.create({ sectionId, userId: user.id, vote });
          action = 'created';
        }
      }

      // Return fresh vote counts from DB (source of truth)
      const freshVotes = await base44.entities.SectionVote.filter({ sectionId });
      const proCount = freshVotes.filter(v => v.vote === 'pro').length;
      const conCount = freshVotes.filter(v => v.vote === 'con').length;

      return Response.json({ success: true, action, proCount, conCount, votes: freshVotes });

    } finally {
      processingVotes.delete(lockKey);
    }

  } catch (error) {
    console.error('[VOTE ON SECTION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});