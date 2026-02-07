import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // Fetch current state in parallel
    const [allVotes, suggestions, documents] = await Promise.all([
      base44.entities.Vote.filter({ suggestionId }),
      base44.entities.Suggestion.filter({ id: suggestionId }),
      base44.asServiceRole.entities.Document.list()
    ]);
    
    const currentVotes = allVotes.filter(v => v.userId === user.id);

    const existingVote = currentVotes[0] || null;
    const suggestion = suggestions[0];
    const document = documents.find(d => d.id === suggestion?.documentId);

    if (!suggestion) {
      return Response.json({ error: 'Suggestion not found' }, { status: 404 });
    }

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

    // Calculate new vote counts
    let newProVotes = suggestion.proVotes || 0;
    let newConVotes = suggestion.conVotes || 0;
    let voteAction = null;

    if (existingVote) {
      if (existingVote.vote === vote) {
        // Cancel vote
        await base44.entities.Vote.delete(existingVote.id);
        if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
        else newConVotes = Math.max(0, newConVotes - 1);
        voteAction = 'canceled';
      } else {
        // Change vote direction
        await base44.entities.Vote.update(existingVote.id, { vote });
        if (vote === 'pro') {
          newProVotes += 1;
          newConVotes = Math.max(0, newConVotes - 1);
        } else {
          newConVotes += 1;
          newProVotes = Math.max(0, newProVotes - 1);
        }
        voteAction = 'changed';
      }
    } else {
      // New vote
      await base44.entities.Vote.create({ suggestionId, userId: user.id, vote });
      if (vote === 'pro') newProVotes += 1;
      else newConVotes += 1;
      voteAction = 'created';
    }

    // Update suggestion vote counts
    await base44.entities.Suggestion.update(suggestionId, {
      proVotes: newProVotes,
      conVotes: newConVotes
    });

    console.log('[VOTE FUNCTION] Vote processed:', { voteAction, newProVotes, newConVotes });

    // Check if should auto-accept
    let accepted = false;
    const delta = newProVotes - newConVotes;
    
    // Calculate threshold
    const consensuses = document.consensuses || [];
    let threshold;
    if (consensuses.length > 0) {
      const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
      threshold = Math.max(2, Math.round(consensusMeterAverage * (document.totalUsersInteracted || 1)));
    } else {
      threshold = Math.max(2, document.threshold || 2);
    }

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

      try {
        console.log('[VOTE FUNCTION] Starting auto-accept process...');
        
        // Schedule auto-accept and points in background (fire-and-forget)
        // This prevents blocking the response
        base44.asServiceRole.functions.invoke('processAcceptance', {
          suggestionId,
          documentId: document.id,
          voterId: user.id,
          wasNewVote: voteAction === 'created' && vote === 'pro'
        }).catch(err => {
          console.error('[VOTE FUNCTION] Background acceptance error:', err);
          processingAcceptance.delete(lockKey);
        });

        accepted = true;
        console.log('[VOTE FUNCTION] Auto-accept scheduled in background');
      } catch (err) {
        console.error('[VOTE FUNCTION] Error scheduling acceptance:', err);
        processingAcceptance.delete(lockKey);
      } finally {
        // Remove lock after 30 seconds to prevent permanent locks
        setTimeout(() => processingAcceptance.delete(lockKey), 30000);
      }
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