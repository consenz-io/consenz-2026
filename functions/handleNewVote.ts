import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: vote } = await req.json();

    if (!vote || event.type !== 'create') {
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    console.log('[AUTOMATION] New vote created:', vote.id);

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

    // שליחת התראה ליוצר ההצעה
    await base44.asServiceRole.entities.Notification.create({
      userId: creator.id,
      type: 'vote_on_suggestion',
      title: `הצבעה חדשה על ההצעה שלך`,
      message: `${voterName} הצביע על ההצעה "${suggestion.title}"`,
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: `/suggestiondetail?id=${suggestion.id}`
    });

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

    console.log('[AUTOMATION] Vote notification sent successfully');
    return Response.json({ success: true });
  } catch (error) {
    console.error('[AUTOMATION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});