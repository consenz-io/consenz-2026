import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();
    console.log('[EXPIRE SUGGESTIONS] Running at:', now);

    const pendingSuggestions = await base44.asServiceRole.entities.Suggestion.filter({ status: 'pending' });
    console.log('[EXPIRE SUGGESTIONS] Total pending:', pendingSuggestions.length);

    const expired = pendingSuggestions.filter(s => s.timerEndsAt && new Date(s.timerEndsAt) <= new Date());
    console.log('[EXPIRE SUGGESTIONS] Expired:', expired.length);

    if (expired.length === 0) {
      return Response.json({ success: true, expired: 0 });
    }

    // Fetch all profiles ONCE outside the loop
    const allProfiles = await base44.asServiceRole.entities.UserPublicProfile.list();

    // Process all expired suggestions in parallel
    await Promise.all(expired.map(async (suggestion) => {
      console.log('[EXPIRE SUGGESTIONS] Expiring:', suggestion.id, suggestion.title);

      // Mark as rejected and fetch votes in parallel
      const [, votes] = await Promise.all([
        base44.asServiceRole.entities.Suggestion.update(suggestion.id, { status: 'rejected', rejectedByAdmin: false }),
        base44.asServiceRole.entities.Vote.filter({ suggestionId: suggestion.id })
      ]);

      // Collect recipient userIds
      const recipientUserIds = new Set();

      // Add creator
      if (suggestion.created_by) {
        const creatorProfile = allProfiles.find(p => p.email === suggestion.created_by);
        if (creatorProfile?.userId) recipientUserIds.add(creatorProfile.userId);
      }

      // Add voters
      votes.forEach(v => {
        if (v.userId) recipientUserIds.add(v.userId);
      });

      // Send notifications in parallel
      await Promise.all(Array.from(recipientUserIds).map(userId => {
        const profile = allProfiles.find(p => p.userId === userId);
        const isCreator = profile?.email === suggestion.created_by;
        return base44.asServiceRole.entities.Notification.create({
          userId,
          type: 'suggestion_expiring',
          title: isCreator ? 'ההצעה שלך פגה תוקף' : 'הצעה פגה תוקף',
          message: `"${suggestion.title || 'הצעה'}" לא קיבלה מספיק תמיכה בזמן הקצוב ונדחתה.`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          read: false,
          actionUrl: `/suggestiondetail?id=${suggestion.id}`
        });
      }));

      console.log('[EXPIRE SUGGESTIONS] Done:', suggestion.id, 'notified', recipientUserIds.size);

      // Award points to con voters if gamification is enabled
      try {
        const documents = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId });
        const document = documents[0];
        if (document?.gamificationEnabled) {
          const conVoterIds = votes.filter(v => v.vote === 'con').map(v => v.userId).filter(Boolean);
          if (conVoterIds.length > 0) {
            const conVoterUsers = await base44.asServiceRole.entities.User.filter({
              id: { $in: conVoterIds }
            });
            await Promise.all(conVoterUsers.map(u =>
              Promise.all([
                base44.asServiceRole.entities.User.update(u.id, { points: (u.points || 1000) + 50 }),
                base44.asServiceRole.entities.PointsTransaction.create({
                  userId: u.id,
                  amount: 50,
                  action: 'vote_influenced_acceptance',
                  description: `הצבעתך השפיעה על דחיית ההצעה: ${suggestion.title || 'הצעה'}`,
                  relatedEntityId: suggestion.id,
                  relatedEntityType: 'suggestion'
                })
              ])
            ));
            console.log('[EXPIRE SUGGESTIONS] ✓ Awarded 50 points to', conVoterUsers.length, 'con voters');
          }
        }
      } catch (pointsErr) {
        console.error('[EXPIRE SUGGESTIONS] Points award failed (non-critical):', pointsErr.message);
      }
    }));

    return Response.json({ success: true, expired: expired.length });
  } catch (error) {
    console.error('[EXPIRE SUGGESTIONS ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});