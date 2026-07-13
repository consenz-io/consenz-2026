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

    // Block voting on expired suggestions even if cron hasn't run yet
    if (suggestion.timerEndsAt && new Date(suggestion.timerEndsAt) <= new Date()) {
      return Response.json({
        error: 'פג תוקף ההצעה — לא ניתן להצביע עליה',
        newProVotes: suggestion.proVotes,
        newConVotes: suggestion.conVotes,
        expired: true
      }, { status: 400 });
    }

    let voteAction = null;

    // Clean up any duplicate votes for this user (safety check)
    const allUserVotes = allVotes.filter(v => v.userId === user.id);
    if (allUserVotes.length > 1) {
      console.warn('[VOTE FUNCTION] Found', allUserVotes.length, 'votes for user, cleaning up duplicates');
      const votes_to_delete = allUserVotes.slice(1); // Keep first, delete rest
      await Promise.all(votes_to_delete.map(v => base44.asServiceRole.entities.Vote.delete(v.id)));
    }
    
    // Re-check after cleanup
    const userVote = allUserVotes.length > 0 ? allUserVotes[0] : null;

    if (userVote) {
      if (userVote.vote === vote) {
        // Cancel vote
        await base44.asServiceRole.entities.Vote.delete(userVote.id);
        voteAction = 'canceled';
      } else {
        // Change vote direction (update exactly the one vote)
        await base44.asServiceRole.entities.Vote.update(userVote.id, { vote });
        voteAction = 'changed';
      }
    } else {
      // New vote — create exactly one
      await base44.asServiceRole.entities.Vote.create({ suggestionId, userId: user.id, vote });
      voteAction = 'created';
    }

    // Re-read the actual votes from DB after mutation - this is the source of truth
    const freshVotes = await base44.asServiceRole.entities.Vote.filter({ suggestionId });
    const newProVotes = freshVotes.filter(v => v.vote === 'pro').length;
    const newConVotes = freshVotes.filter(v => v.vote === 'con').length;

    // Verify: each user can only have ONE vote — clean up if duplicates found
    const votesByUser = new Map();
    const duplicateVoteIds = [];
    freshVotes.forEach(v => {
      if (votesByUser.has(v.userId)) {
        console.warn('[VOTE FUNCTION] DUPLICATE VOTE DETECTED for userId:', v.userId, 'on suggestion:', suggestionId);
        duplicateVoteIds.push(v.id); // Mark for cleanup
      } else {
        votesByUser.set(v.userId, v);
      }
    });
    
    // Delete duplicate votes discovered after the mutation
    if (duplicateVoteIds.length > 0) {
      console.log('[VOTE FUNCTION] Cleaning up', duplicateVoteIds.length, 'duplicate votes');
      await Promise.all(duplicateVoteIds.map(id => base44.asServiceRole.entities.Vote.delete(id)));
    }

    // Update suggestion vote counts based on actual DB count
    // IMPORTANT: Using increment-style logic to be safer in case of concurrent updates
    // But safest approach is using the count we just verified
    await base44.asServiceRole.entities.Suggestion.update(suggestionId, {
      proVotes: newProVotes,
      conVotes: newConVotes
    });

    console.log('[VOTE FUNCTION] Vote processed:', { voteAction, newProVotes, newConVotes });

    // ── Update document.totalUsersInteracted on new vote ────────────────
    // Recalculate the document's stored participant count to include the new voter.
    // This mirrors the logic in voteOnSection and ensures suggestion voters are
    // always counted as document participants (and, via getHomeStats / groupParticipants,
    // as group participants too).
    if (voteAction === 'created') {
      try {
        const docSuggestions = await base44.asServiceRole.entities.Suggestion.filter({ documentId: document.id });
        const docSuggestionIds = docSuggestions.map(s => s.id);
        const docSections = await base44.asServiceRole.entities.Section.filter({ documentId: document.id });
        const docSectionIds = docSections.map(s => s.id);
        const [docSuggestionVotes, docSectionVotes, docAgreements, profiles] = await Promise.all([
          docSuggestionIds.length > 0
            ? base44.asServiceRole.entities.Vote.filter({ suggestionId: { $in: docSuggestionIds } })
            : Promise.resolve([]),
          docSectionIds.length > 0
            ? base44.asServiceRole.entities.SectionVote.filter({ sectionId: { $in: docSectionIds } })
            : Promise.resolve([]),
          base44.asServiceRole.entities.DocumentAgreement.filter({ documentId: document.id }),
          base44.asServiceRole.entities.UserPublicProfile.list()
        ]);
        const userIdToEmail = {};
        profiles.forEach(p => { if (p.userId) userIdToEmail[p.userId] = p.email; });
        const uniqueEmails = new Set();
        docSuggestions.forEach(s => { if (s.created_by) uniqueEmails.add(s.created_by); });
        docSuggestionVotes.forEach(v => {
          if (v.created_by) uniqueEmails.add(v.created_by);
          if (v.userId && userIdToEmail[v.userId]) uniqueEmails.add(userIdToEmail[v.userId]);
        });
        docSectionVotes.forEach(v => {
          if (v.created_by) uniqueEmails.add(v.created_by);
          if (v.userId && userIdToEmail[v.userId]) uniqueEmails.add(userIdToEmail[v.userId]);
        });
        docAgreements.forEach(a => { if (a.userEmail) uniqueEmails.add(a.userEmail); });
        const totalUsers = Math.max(1, uniqueEmails.size);
        await base44.asServiceRole.entities.Document.update(document.id, { totalUsersInteracted: totalUsers });
        console.log('[VOTE FUNCTION] Updated totalUsersInteracted:', totalUsers);
      } catch (e) {
        console.error('[VOTE FUNCTION totalUsersInteracted update error]', e);
      }
    }

    // Check if should auto-accept
    let accepted = false;
    const delta = newProVotes - newConVotes;
    
    // Use the document's stored threshold (same logic as checkSuggestionConsensus on the frontend)
    // threshold is updated only when a suggestion is accepted, not dynamically during voting
    const threshold = document.threshold > 0 ? Math.max(2, document.threshold) : 2;

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

      // Call processAcceptance synchronously (not fire-and-forget) so we have full context
      try {
        await base44.asServiceRole.functions.invoke('processAcceptance', {
          suggestionId,
          documentId: document.id,
          voterId: user.id,
          wasNewVote: voteAction === 'created' && vote === 'pro'
        });
        console.log('[VOTE FUNCTION] processAcceptance completed successfully');
      } catch (err) {
        console.error('[VOTE FUNCTION] processAcceptance error:', err);
      } finally {
        processingAcceptance.delete(lockKey);
      }

      accepted = true;
      console.log('[VOTE FUNCTION] processAcceptance completed, suggestion accepted');
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