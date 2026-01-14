import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { suggestionId, action } = await req.json();

    if (!suggestionId) {
      return Response.json({ error: 'Missing suggestionId' }, { status: 400 });
    }

    // Fetch suggestion
    const suggestions = await base44.entities.Suggestion.filter({ id: suggestionId });
    if (suggestions.length === 0) {
      return Response.json({ error: 'Suggestion not found' }, { status: 404 });
    }
    const suggestion = suggestions[0];

    // Fetch document to check gamification
    const documents = await base44.entities.Document.filter({ id: suggestion.documentId });
    if (documents.length === 0 || !documents[0].gamificationEnabled) {
      return Response.json({ success: true, message: 'Gamification not enabled' });
    }

    // Get all users to find creator
    const allUsers = await base44.asServiceRole.listUsers();
    const suggestionCreator = allUsers.find(u => u.email === suggestion.created_by);

    if (!suggestionCreator) {
      return Response.json({ error: 'Suggestion creator not found' }, { status: 404 });
    }

    // Award points based on action
    let pointsAmount = 0;
    let description = '';

    if (action === 'suggestion_accepted') {
      pointsAmount = 200;
      description = `ההצעה שלך התקבלה: ${suggestion.title || 'הצעה'}`;
    } else if (action === 'topic_edit_accepted') {
      pointsAmount = 100;
      description = `הצעתך לעריכת כותרת נושא התקבלה`;
    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    const newPoints = (suggestionCreator.points || 1000) + pointsAmount;

    await Promise.all([
      base44.asServiceRole.updateUser(suggestionCreator.id, { points: newPoints }),
      base44.entities.PointsTransaction.create({
        userId: suggestionCreator.id,
        amount: pointsAmount,
        action,
        description,
        relatedEntityId: suggestionId,
        relatedEntityType: action === 'topic_edit_accepted' ? 'topic' : 'suggestion'
      })
    ]);

    return Response.json({ 
      success: true, 
      newPoints,
      pointsAwarded: pointsAmount 
    });
  } catch (error) {
    console.error('[AWARD POINTS ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});