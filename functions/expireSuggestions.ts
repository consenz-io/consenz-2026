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

    for (const suggestion of expired) {
      console.log('[EXPIRE SUGGESTIONS] Expiring:', suggestion.id, suggestion.title);
      await base44.asServiceRole.entities.Suggestion.update(suggestion.id, { status: 'rejected' });

      const recipientIds = new Set();
      if (suggestion.created_by_id) recipientIds.add(suggestion.created_by_id);

      const votes = await base44.asServiceRole.entities.Vote.filter({ suggestionId: suggestion.id });
      votes.forEach(v => { if (v.userId) recipientIds.add(v.userId); });

      for (const userId of Array.from(recipientIds)) {
        await base44.asServiceRole.entities.Notification.create({
          userId,
          type: 'suggestion_rejected',
          title: userId === suggestion.created_by_id ? 'ההצעה שלך פגה תוקף' : 'הצעה פגה תוקף',
          message: `"${suggestion.title || 'הצעה'}" לא קיבלה מספיק תמיכה בזמן הקצוב ונדחתה.`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion',
          read: false,
          actionUrl: `/suggestiondetail?id=${suggestion.id}`
        });
      }
      console.log('[EXPIRE SUGGESTIONS] Done:', suggestion.id, 'notified', recipientIds.size);
    }

    return Response.json({ success: true, expired: expired.length });
  } catch (error) {
    console.error('[EXPIRE SUGGESTIONS ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});