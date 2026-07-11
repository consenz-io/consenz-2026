import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { commentId, isLiking } = await req.json();
    if (!commentId) return Response.json({ error: 'Missing commentId' }, { status: 400 });

    const comments = await base44.asServiceRole.entities.Comment.filter({ id: commentId });
    if (comments.length === 0) return Response.json({ error: 'Comment not found' }, { status: 404 });
    const comment = comments[0];

    const creatorId = comment.created_by_id;
    if (!creatorId) return Response.json({ success: true, message: 'No creator' });
    // Don't award points for self-likes
    if (creatorId === user.id) return Response.json({ success: true, message: 'Self-like' });

    // Resolve documentId + actionUrl from the comment's root entity
    let documentId = null;
    let actionUrl = null;
    if (comment.rootEntityType === 'suggestion') {
      const s = await base44.asServiceRole.entities.Suggestion.filter({ id: comment.rootEntityId });
      if (s.length > 0) documentId = s[0].documentId;
      actionUrl = `/suggestiondetail?id=${comment.rootEntityId}&commentId=${commentId}`;
    } else if (comment.rootEntityType === 'section') {
      const s = await base44.asServiceRole.entities.Section.filter({ id: comment.rootEntityId });
      if (s.length > 0) documentId = s[0].documentId;
      // Link to suggestiondetail when an accepted suggestion exists, else documentview
      const accepted = await base44.asServiceRole.entities.Suggestion.filter({ sectionId: comment.rootEntityId, status: 'accepted' });
      const latest = accepted.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];
      actionUrl = latest
        ? `/suggestiondetail?id=${latest.id}&commentId=${commentId}`
        : `/documentview?id=${documentId}&commentId=${commentId}`;
    } else if (comment.rootEntityType === 'argument') {
      const a = await base44.asServiceRole.entities.Argument.filter({ id: comment.rootEntityId });
      if (a.length > 0) {
        actionUrl = `/suggestiondetail?id=${a[0].suggestionId}&commentId=${commentId}`;
        const s = await base44.asServiceRole.entities.Suggestion.filter({ id: a[0].suggestionId });
        if (s.length > 0) documentId = s[0].documentId;
      }
    }
    if (!documentId) return Response.json({ success: true, message: 'No document' });

    const docs = await base44.asServiceRole.entities.Document.filter({ id: documentId });
    if (docs.length === 0 || !docs[0].gamificationEnabled) {
      return Response.json({ success: true, message: 'Gamification not enabled' });
    }

    const amount = isLiking ? 5 : -5;
    const action = isLiking ? 'comment_like_received' : 'comment_like_removed';
    const description = isLiking ? 'קיבלת לייק על תגובה' : 'בוטל לייק על תגובה';

    const usersList = await base44.asServiceRole.entities.User.filter({ id: creatorId });
    if (usersList.length === 0) return Response.json({ error: 'Creator not found' }, { status: 404 });
    const creator = usersList[0];
    const newPoints = (creator.points || 1000) + amount;

    await Promise.all([
      base44.asServiceRole.entities.User.update(creator.id, { points: newPoints }),
      base44.asServiceRole.entities.PointsTransaction.create({
        userId: creator.id,
        amount,
        action,
        description,
        relatedEntityId: commentId,
        relatedEntityType: 'comment',
        actionUrl
      })
    ]);

    console.log(`[AWARD COMMENT LIKE] ${isLiking ? '+' : '-'}5 points to creator ${creator.id} for comment ${commentId}`);
    return Response.json({ success: true, awarded: amount });
  } catch (error) {
    console.error('[AWARD COMMENT LIKE ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});