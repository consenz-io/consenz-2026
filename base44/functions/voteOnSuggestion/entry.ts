import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Rate limiter for voting
const voteRateLimiter = new Map();
const VOTE_RATE_LIMIT = 5; // 5 votes per minute
const VOTE_WINDOW_MS = 60000;

function checkVoteRateLimit(userId) {
  const now = Date.now();
  const userKey = `vote-${userId}`;
  
  if (!voteRateLimiter.has(userKey)) {
    voteRateLimiter.set(userKey, { count: 1, resetAt: now + VOTE_WINDOW_MS });
    return { allowed: true };
  }
  
  const record = voteRateLimiter.get(userKey);
  
  if (now >= record.resetAt) {
    record.count = 1;
    record.resetAt = now + VOTE_WINDOW_MS;
    voteRateLimiter.set(userKey, record);
    return { allowed: true };
  }
  
  record.count++;
  voteRateLimiter.set(userKey, record);
  
  if (record.count > VOTE_RATE_LIMIT) {
    const remainingSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { 
      allowed: false, 
      remainingSeconds,
      message: `נא להמתין ${remainingSeconds} שניות לפני הצבעה נוספת`
    };
  }
  
  return { allowed: true };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of voteRateLimiter.entries()) {
    if (now >= record.resetAt) {
      voteRateLimiter.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Track processing suggestions to prevent concurrent auto-accepts
const processingAcceptance = new Set();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { suggestionId, vote } = await req.json();

    if (!suggestionId || !vote) {
      return Response.json({ error: 'Missing suggestionId or vote' }, { status: 400 });
    }

    if (vote !== 'pro' && vote !== 'con') {
      return Response.json({ error: 'Invalid vote value' }, { status: 400 });
    }

    // Check rate limit
    const rateLimitCheck = checkVoteRateLimit(user.id);
    if (!rateLimitCheck.allowed) {
      return Response.json(
        { error: rateLimitCheck.message, remainingSeconds: rateLimitCheck.remainingSeconds },
        { status: 429 }
      );
    }

    console.log('[VOTE FUNCTION] Processing vote:', { suggestionId, vote, userId: user.id });

    // Fetch current state in parallel — use asServiceRole for both to avoid platform rate limits
    const [allVotes, suggestion] = await Promise.all([
      base44.asServiceRole.entities.Vote.filter({ suggestionId }),
      base44.asServiceRole.entities.Suggestion.get(suggestionId),
    ]);
    
    const existingVote = allVotes.find(v => v.userId === user.id) || null;

    if (!suggestion) {
      return Response.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    const documentResults = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId });
    
    const document = documentResults[0];

    if (!document) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    if (suggestion.status !== 'pending') {
      return Response.json({ 
        error: 'לא ניתן להצביע על הצעה שכבר טופלה',
        newProVotes: suggestion.proVotes,
        newConVotes: suggestion.conVotes,
        status: suggestion.status
      }, { status: 400 });
    }

    let voteAction = null;

    if (existingVote) {
      if (existingVote.vote === vote) {
        // Cancel vote
        await base44.asServiceRole.entities.Vote.delete(existingVote.id);
        voteAction = 'canceled';
      } else {
        // Change vote direction
        await base44.asServiceRole.entities.Vote.update(existingVote.id, { vote });
        voteAction = 'changed';
      }
    } else {
      // New vote — check for duplicate before creating (guard against double-click race)
      const dupeCheck = allVotes.filter(v => v.userId === user.id);
      if (dupeCheck.length > 0) {
        console.log('[VOTE FUNCTION] Duplicate vote detected, updating instead of creating');
        await base44.asServiceRole.entities.Vote.update(dupeCheck[0].id, { vote });
        voteAction = 'changed';
      } else {
        await base44.asServiceRole.entities.Vote.create({ suggestionId, userId: user.id, vote });
        voteAction = 'created';
      }
    }

    // Re-read the actual votes from DB after mutation - this is the source of truth
    const freshVotes = await base44.asServiceRole.entities.Vote.filter({ suggestionId });
    const newProVotes = freshVotes.filter(v => v.vote === 'pro').length;
    const newConVotes = freshVotes.filter(v => v.vote === 'con').length;

    // Verify: each user can only have ONE vote — log if violation found
    const votesByUser = new Map();
    freshVotes.forEach(v => {
      if (votesByUser.has(v.userId)) {
        console.warn('[VOTE FUNCTION] DUPLICATE VOTE DETECTED for userId:', v.userId, 'on suggestion:', suggestionId);
      }
      votesByUser.set(v.userId, v);
    });

    // Update suggestion vote counts based on actual DB count
    await base44.asServiceRole.entities.Suggestion.update(suggestionId, {
      proVotes: newProVotes,
      conVotes: newConVotes
    });

    console.log('[VOTE FUNCTION] Vote processed:', { voteAction, newProVotes, newConVotes });

    // Check if should auto-accept
    let accepted = false;
    const delta = newProVotes - newConVotes;
    
    // Use the document's stored threshold (same logic as checkSuggestionConsensus on the frontend)
    // threshold is updated only when a suggestion is accepted, not dynamically during voting
    const threshold = Math.max(2, document.threshold || 2);

    const shouldAccept = delta >= threshold;

    console.log('[VOTE FUNCTION] Consensus check:', { delta, threshold, shouldAccept });

    if (shouldAccept && suggestion.status === 'pending') {
      // Prevent concurrent acceptance processing
      const lockKey = `accept-${suggestionId}`;
      if (processingAcceptance.has(lockKey)) {
        console.log('[VOTE FUNCTION] Already processing acceptance, skipping');
        return Response.json({ 
          success: true, 
          newProVotes, 
          newConVotes, 
          accepted: false,
          message: 'Vote counted, acceptance in progress'
        });
      }

      processingAcceptance.add(lockKey);

      // Fire-and-forget: run processAcceptance in background, clean up lock when done
      base44.asServiceRole.functions.invoke('processAcceptance', {
        suggestionId,
        documentId: document.id,
        voterId: user.id,
        wasNewVote: voteAction === 'created' && vote === 'pro'
      }).then(() => {
        processingAcceptance.delete(lockKey);
      }).catch(err => {
        console.error('[VOTE FUNCTION] Background acceptance error:', err);
        processingAcceptance.delete(lockKey);
      });

      accepted = true;
      // Safety net: release lock after 60s in case the promise never settles
      setTimeout(() => processingAcceptance.delete(lockKey), 60000);
      console.log('[VOTE FUNCTION] Auto-accept scheduled in background');
    }

    return Response.json({
      success: true,
      newProVotes,
      newConVotes,
      accepted,
      voteAction,
      message: accepted ? 'ההצבעה נספרה וההצעה עברה לאישור' : 'ההצבעה נספרה בהצלחה'
    });

  } catch (error) {
    console.error('[VOTE FUNCTION ERROR]', error);
    return Response.json({ 
      error: error.message || 'שגיאה בעיבוד ההצבעה',
      details: error.stack
    }, { status: 500 });
  }
});