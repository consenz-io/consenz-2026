import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('[VOTE AUTOMATION] ===== START =====');
  console.log('[VOTE AUTOMATION] Timestamp:', new Date().toISOString());
  
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: vote } = await req.json();

    console.log('[VOTE AUTOMATION] Event type:', event?.type);
    console.log('[VOTE AUTOMATION] Vote data received:', {
      id: vote?.id,
      userId: vote?.userId,
      suggestionId: vote?.suggestionId,
      vote: vote?.vote
    });

    if (!vote || event.type !== 'create') {
      console.log('[VOTE AUTOMATION] ⏭️ Skipping - not a create event');
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    console.log('[VOTE AUTOMATION] ✅ Processing new vote:', vote.id);

    // קבלת ההצעה
    const suggestion = await base44.asServiceRole.entities.Suggestion.filter({ id: vote.suggestionId }).then(s => s[0]);
    if (!suggestion) {
      console.log('[AUTOMATION] Suggestion not found');
      return Response.json({ message: 'Suggestion not found' }, { status: 200 });
    }

    // קבלת המסמך
    const document = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }).then(d => d[0]);
    if (!document) {
      console.log('[AUTOMATION] Document not found');
      return Response.json({ message: 'Document not found' }, { status: 200 });
    }

    // קבלת פרטי המצביע
    const voterProfile = await base44.asServiceRole.entities.UserPublicProfile.filter({ userId: vote.userId }).then(p => p[0]);
    const voterName = voterProfile?.fullName || 'User';

    // קבלת יוצר ההצעה
    const creatorUsers = await base44.asServiceRole.entities.User.filter({ email: suggestion.created_by });
    if (creatorUsers.length === 0) {
      console.log('[AUTOMATION] Creator not found');
      return Response.json({ message: 'Creator not found' }, { status: 200 });
    }
    const creator = creatorUsers[0];

    // אל תשלח התראה אם המצביע הוא יוצר ההצעה
    if (vote.userId === creator.id) {
      console.log('[AUTOMATION] Voter is creator, skipping notification');
      return Response.json({ message: 'Voter is creator' }, { status: 200 });
    }

    // Vote notifications disabled
    // await base44.asServiceRole.entities.Notification.create(...);

    // טיפול בנקודות אם gamification מופעל
    if (document.gamificationEnabled && vote.vote === 'pro') {
      const currentPoints = creator.points || 1000;
      await base44.asServiceRole.entities.User.update(creator.id, {
        points: currentPoints + 10
      });
      
      await base44.asServiceRole.entities.PointsTransaction.create({
        userId: creator.id,
        amount: 10,
        action: 'vote_received',
        description: `קיבל הצבעה בעד על ההצעה: ${suggestion.title}`,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion'
      });
      
      console.log('[AUTOMATION] Awarded 10 points to suggestion creator');
    }

    const duration = Date.now() - startTime;
    console.log('[VOTE AUTOMATION] ✅ Completed successfully');
    console.log('[VOTE AUTOMATION] Duration:', duration, 'ms');
    console.log('[VOTE AUTOMATION] ===== END =====');
    
    return Response.json({ 
      success: true,
      duration,
      voteId: vote.id
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[VOTE AUTOMATION] ❌ ERROR:', error.message);
    console.error('[VOTE AUTOMATION] Error stack:', error.stack);
    console.error('[VOTE AUTOMATION] Duration before error:', duration, 'ms');
    console.error('[VOTE AUTOMATION] Vote data:', JSON.stringify(vote, null, 2));
    console.error('[VOTE AUTOMATION] ===== END (ERROR) =====');
    
    return Response.json({ 
      error: error.message,
      duration,
      voteId: vote?.id 
    }, { status: 500 });
  }
});