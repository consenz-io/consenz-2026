import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    // Process expired suggestions sequentially to avoid quota burst
    let processedCount = 0;
    for (const suggestion of expired) {
      console.log('[EXPIRE SUGGESTIONS] Expiring:', suggestion.id, suggestion.title);

      // Mark as rejected and fetch votes in parallel (within one suggestion is fine)
      const [, votes] = await Promise.all([
        base44.asServiceRole.entities.Suggestion.update(suggestion.id, { status: 'rejected', rejectedByAdmin: false }),
        base44.asServiceRole.entities.Vote.filter({ suggestionId: suggestion.id })
      ]);

      // Collect recipient userIds
      const recipientUserIds = new Set();

      if (suggestion.created_by_id) {
        recipientUserIds.add(suggestion.created_by_id);
      }

      votes.forEach(v => { if (v.userId) recipientUserIds.add(v.userId); });

      // Send notifications sequentially
      for (const userId of recipientUserIds) {
        const isCreator = userId === suggestion.created_by_id;
        await base44.asServiceRole.entities.Notification.create({
          userId,
          type: 'suggestion_expiring',
          title: isCreator ? 'ההצעה שלך פגה תוקף' : 'הצעה פגה תוקף',
          message: `"${suggestion.title || 'הצעה'}" לא קיבלה מספיק תמיכה בזמן הקצוב ונדחתה.`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          read: false,
          actionUrl: `/suggestiondetail?id=${suggestion.id}`
        });
      }

      console.log('[EXPIRE SUGGESTIONS] Done:', suggestion.id, 'notified', recipientUserIds.size);

      // Award points to con voters if gamification is enabled
      try {
        const documents = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId });
        const document = documents[0];
        if (document?.gamificationEnabled) {
          const conVoterIds = votes.filter(v => v.vote === 'con').map(v => v.userId).filter(Boolean);
          if (conVoterIds.length > 0) {
            // Fetch all users and filter client-side (platform doesn't reliably support $in on User)
            const allUsers = await base44.asServiceRole.entities.User.list();
            const conVoterUsers = allUsers.filter(u => conVoterIds.includes(u.id));
            for (const u of conVoterUsers) {
              await Promise.all([
                base44.asServiceRole.entities.User.update(u.id, { points: (u.points || 1000) + 50 }),
                base44.asServiceRole.entities.PointsTransaction.create({
                  userId: u.id,
                  amount: 50,
                  action: 'vote_influenced_acceptance',
                  description: `הצבעתך השפיעה על דחיית ההצעה: ${suggestion.title || 'הצעה'}`,
                  relatedEntityId: suggestion.id,
                  relatedEntityType: 'suggestion'
                })
              ]);
            }
            console.log('[EXPIRE SUGGESTIONS] ✓ Awarded 50 points to', conVoterUsers.length, 'con voters');
          }
        }
      } catch (pointsErr) {
        console.error('[EXPIRE SUGGESTIONS] Points award failed (non-critical):', pointsErr.message);
      }

      processedCount++;
    }

    return Response.json({ success: true, expired: processedCount });
  } catch (error) {
    console.error('[EXPIRE SUGGESTIONS ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});