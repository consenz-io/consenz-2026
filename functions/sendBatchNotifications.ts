import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notifications } = await req.json();

    if (!notifications || notifications.length === 0) {
      return Response.json({ success: true, successful: 0, failed: 0 });
    }

    console.log('[BATCH NOTIFICATIONS] Creating', notifications.length, 'notifications');

    // Validate each notification has required fields
    const valid = notifications.filter(n => n.userId && n.type && n.title && n.message);

    if (valid.length === 0) {
      return Response.json({ success: true, successful: 0, failed: notifications.length });
    }

    await base44.asServiceRole.entities.Notification.bulkCreate(
      valid.map(n => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        translations: n.translations || {},
        relatedEntityId: n.relatedEntityId || null,
        relatedEntityType: n.relatedEntityType || null,
        actionUrl: n.actionUrl || null,
        read: false
      }))
    );

    console.log('[BATCH NOTIFICATIONS] ✓ Created', valid.length, 'notifications');
    return Response.json({ success: true, successful: valid.length, failed: notifications.length - valid.length });
  } catch (error) {
    console.error('[BATCH NOTIFICATIONS] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});