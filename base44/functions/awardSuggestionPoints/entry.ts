import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { suggestionId, action } = await req.json();

    if (!suggestionId) {
      return Response.json({ error: 'Missing suggestionId' }, { status: 400 });
    }

    // Fetch suggestion using service role (called from processAcceptance without user context)
    const suggestions = await base44.asServiceRole.entities.Suggestion.filter({ id: suggestionId });
    if (suggestions.length === 0) {
      return Response.json({ error: 'Suggestion not found' }, { status: 404 });
    }
    const suggestion = suggestions[0];

    // Fetch document to check gamification
    const documents = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId });
    if (documents.length === 0 || !documents[0].gamificationEnabled) {
      return Response.json({ success: true, message: 'Gamification not enabled' });
    }

    const creatorEmail = suggestion.created_by;
    if (!creatorEmail) {
      return Response.json({ error: 'No creator email found' }, { status: 404 });
    }

    // Award points based on action
    let pointsAmount = 0;
    let description = '';

    if (action === 'suggestion_accepted') {
      pointsAmount = 500;
      description = `ההצעה שלך התקבלה: ${suggestion.title || 'הצעה'}`;
    } else if (action === 'topic_edit_accepted') {
      pointsAmount = 100;
      description = `הצעתך לעריכת כותרת נושא התקבלה`;
    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // 1. Award points to the suggestion CREATOR
    const usersList = await base44.asServiceRole.entities.User.filter({ email: creatorEmail });
    if (usersList.length === 0) {
      return Response.json({ error: 'Creator user not found' }, { status: 404 });
    }
    const creator = usersList[0];
    const newCreatorPoints = (creator.points || 1000) + pointsAmount;

    await Promise.all([
      base44.asServiceRole.entities.User.update(creator.id, { points: newCreatorPoints }),
      base44.asServiceRole.entities.PointsTransaction.create({
        userId: creator.id,
        amount: pointsAmount,
        action,
        description,
        relatedEntityId: suggestionId,
        relatedEntityType: action === 'topic_edit_accepted' ? 'topic' : 'suggestion'
      })
    ]);

    console.log('[AWARD POINTS] ✓ Creator awarded', pointsAmount, 'points:', creatorEmail);

    // 2. Award 50 points to each PRO voter who influenced the acceptance
    //    (only for suggestion_accepted, not topic_edit_accepted)
    if (action === 'suggestion_accepted') {
      const votes = await base44.asServiceRole.entities.Vote.filter({ suggestionId });
      const proVoterIds = votes.filter(v => v.vote === 'pro').map(v => v.userId).filter(Boolean);

      if (proVoterIds.length > 0) {
        // Fetch all users and filter client-side (platform doesn't reliably support $in on User)
        const allUsers = await base44.asServiceRole.entities.User.list();
        const proVoters = allUsers.filter(u => proVoterIds.includes(u.id) && u.email !== creatorEmail);

        for (const voter of proVoters) {
          await Promise.all([
            base44.asServiceRole.entities.User.update(voter.id, { points: (voter.points || 1000) + 50 }),
            base44.asServiceRole.entities.PointsTransaction.create({
              userId: voter.id,
              amount: 50,
              action: 'vote_influenced_acceptance',
              description: `הצבעתך בעד השפיעה על קבלת ההצעה: ${suggestion.title || 'הצעה'}`,
              relatedEntityId: suggestionId,
              relatedEntityType: 'suggestion'
            })
          ]);
        }

        console.log('[AWARD POINTS] ✓ Awarded 50 points to', proVoters.length, 'pro voters');
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[AWARD POINTS ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});