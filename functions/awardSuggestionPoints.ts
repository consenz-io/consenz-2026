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

    // Get creator user ID from created_by_id field
    const creatorId = suggestion.created_by_id;
    if (!creatorId) {
      return Response.json({ error: 'No creator ID found' }, { status: 404 });
    }

    // Get current user points
    const usersList = await base44.asServiceRole.entities.User.filter({ id: creatorId });
    if (usersList.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const currentUser = usersList[0];

    // Award points based on action and suggestion type
     let pointsAmount = 0;
     let description = '';

     if (action === 'suggestion_accepted') {
       // Award points based on suggestion type
       switch (suggestion.type) {
         case 'new_section':
           pointsAmount = 500;
           description = `הצעה לסעיף חדש התקבלה: ${suggestion.title || 'הצעה'}`;
           break;
         case 'edit_section':
           pointsAmount = 500;
           description = `הצעה לשינוי סעיף התקבלה: ${suggestion.title || 'הצעה'}`;
           break;
         case 'delete_section':
           pointsAmount = 500;
           description = `הצעה למחיקת סעיף התקבלה: ${suggestion.title || 'הצעה'}`;
           break;
         case 'edit_suggestion':
           pointsAmount = 500;
           description = `הצעה לשינוי הצעה התקבלה: ${suggestion.title || 'הצעה'}`;
           break;
         default:
           pointsAmount = 500;
           description = `ההצעה שלך התקבלה: ${suggestion.title || 'הצעה'}`;
       }
     } else if (action === 'topic_edit_accepted') {
       pointsAmount = 100;
       description = `הצעתך לעריכת כותרת נושא התקבלה`;
     } else {
       return Response.json({ error: 'Invalid action' }, { status: 400 });
     }

    const newPoints = (currentUser.points || 1000) + pointsAmount;

    await Promise.all([
      base44.asServiceRole.entities.User.update(creatorId, { points: newPoints }),
      base44.entities.PointsTransaction.create({
        userId: creatorId,
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