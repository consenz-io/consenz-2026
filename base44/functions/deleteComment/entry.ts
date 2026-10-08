import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Deletes a comment and cleans up all notifications that point directly to it
// (relatedEntityType: 'comment'). The comment owner or an admin may call this.
// Other notification types (suggestion_comment, section_comment, document_comment)
// reference the parent entity (suggestion/section/document), not the comment, so
// they are intentionally left in place — the parent entity still exists.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commentId } = await req.json();
    if (!commentId) {
      return Response.json({ error: 'Missing commentId' }, { status: 400 });
    }

    // Fetch the comment via service role so we can read it regardless of RLS,
    // then verify ownership/admin before deleting.
    let comment = null;
    try {
      const comments = await base44.asServiceRole.entities.Comment.filter({ id: commentId });
      comment = comments[0];
    } catch {
      // Malformed ID or query error — treat as already deleted so the client
      // can clean up its caches without surfacing an error to the user.
      return Response.json({ success: true, alreadyDeleted: true });
    }
    if (!comment) {
      // Already deleted — treat as success so the client can clean up its caches.
      return Response.json({ success: true, alreadyDeleted: true });
    }

    const isOwner = comment.created_by_id === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the comment and any notifications that point directly to it.
    // Run in parallel — both are independent.
    const notifs = await base44.asServiceRole.entities.Notification.filter({
      relatedEntityId: commentId,
      relatedEntityType: 'comment'
    });

    await Promise.allSettled([
      base44.asServiceRole.entities.Comment.delete(commentId),
      notifs.length > 0
        ? base44.asServiceRole.entities.Notification.deleteMany({
            relatedEntityId: commentId,
            relatedEntityType: 'comment'
          })
        : Promise.resolve()
    ]);

    return Response.json({
      success: true,
      deletedNotifications: notifs.length
    });
  } catch (error) {
    console.error('[deleteComment] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}