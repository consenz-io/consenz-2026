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

    // Fetch all required data in parallel - OPTIMIZED
    console.log('[VOTE AUTOMATION] Fetching data in parallel...');
    const [suggestions, documents, creatorUsers] = await Promise.all([
      base44.asServiceRole.entities.Suggestion.filter({ id: vote.suggestionId }),
      base44.asServiceRole.entities.Document.list(),
      base44.asServiceRole.entities.User.list(),
    ]);

    const suggestion = suggestions[0];
    if (!suggestion) {
      console.log('[VOTE AUTOMATION] ⚠️ Suggestion not found:', vote.suggestionId);
      return Response.json({ message: 'Suggestion not found' }, { status: 404 });
    }

    const document = documents.find(d => d.id === suggestion.documentId);
    if (!document) {
      console.log('[VOTE AUTOMATION] ⚠️ Document not found:', suggestion.documentId);
      return Response.json({ message: 'Document not found' }, { status: 404 });
    }

    const creator = creatorUsers.find(u => u.email === suggestion.created_by);
    if (!creator) {
      console.log('[VOTE AUTOMATION] ⚠️ Creator not found:', suggestion.created_by);
      return Response.json({ message: 'Creator not found' }, { status: 404 });
    }

    console.log('[VOTE AUTOMATION] ✅ All data fetched successfully');

    // אל תשלח התראה אם המצביע הוא יוצר ההצעה
    if (vote.userId === creator.id) {
      console.log('[VOTE AUTOMATION] ⏭️ Voter is creator, skipping all processing');
      return Response.json({ message: 'Voter is creator' }, { status: 200 });
    }

    // טיפול בנקודות אם gamification מופעל - OPTIMIZED: Atomic operations
    if (document.gamificationEnabled && vote.vote === 'pro') {
      console.log('[VOTE AUTOMATION] Processing points for pro vote...');
      
      try {
        const currentPoints = creator.points || 1000;
        
        // Execute both operations in parallel
        await Promise.all([
          base44.asServiceRole.entities.User.update(creator.id, {
            points: currentPoints + 10
          }),
          base44.asServiceRole.entities.PointsTransaction.create({
            userId: creator.id,
            amount: 10,
            action: 'vote_received',
            description: `קיבל הצבעה בעד על ההצעה: ${suggestion.title}`,
            relatedEntityId: suggestion.id,
            relatedEntityType: 'suggestion'
          })
        ]);
        
        console.log('[VOTE AUTOMATION] ✅ Awarded 10 points to suggestion creator');
      } catch (pointsError) {
        console.error('[VOTE AUTOMATION] ⚠️ Points error (non-critical):', pointsError.message);
        // Don't fail the entire request if points fail
      }
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
    console.error('[VOTE AUTOMATION] ❌ CRITICAL ERROR:', error.message);
    console.error('[VOTE AUTOMATION] Error stack:', error.stack);
    console.error('[VOTE AUTOMATION] Error name:', error.name);
    console.error('[VOTE AUTOMATION] Duration before error:', duration, 'ms');
    console.error('[VOTE AUTOMATION] Vote data:', {
      id: vote?.id,
      userId: vote?.userId,
      suggestionId: vote?.suggestionId,
      vote: vote?.vote
    });
    console.error('[VOTE AUTOMATION] ===== END (ERROR) =====');
    
    // Return appropriate status code based on error type
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    
    return Response.json({ 
      error: error.message,
      errorType: error.name,
      duration,
      voteId: vote?.id 
    }, { status: statusCode });
  }
});