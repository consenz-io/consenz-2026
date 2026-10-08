import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { checkDocumentAccess } from '../../shared/documentAuth.ts';

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

    // ── Server-side likes-array transition (source of truth) ──────────────
    // This function owns the likes array. The client no longer updates
    // comment.likes directly — it only calls this function. Authorization is
    // based on the actual state of the likes array (server-controlled via
    // asServiceRole), NOT on forgeable PointsTransaction records (whose create
    // RLS is open to any user).
    //
    // For like: caller's email must be ABSENT (not already liked).
    // For unlike: caller's email must be PRESENT (they actually liked).
    // An attacker who never liked will fail the unlike check because their
    // email was never in the array.
    const likes = comment.likes || [];
    const userLiked = likes.includes(user.email);

    if (isLiking && userLiked) {
      return Response.json({ success: true, message: 'Already liked' });
    }
    if (!isLiking && !userLiked) {
      return Response.json({ error: 'Caller did not like this comment' }, { status: 403 });
    }

    const creatorId = comment.created_by_id;
    if (!creatorId) return Response.json({ success: true, message: 'No creator' });
    // Don't award points for self-likes
    if (creatorId === user.id) return Response.json({ success: true, message: 'Self-like' });

    // ── Idempotency: skip if points were already adjusted for this comment ──
    const expectedAction = isLiking ? 'comment_like_received' : 'comment_like_removed';
    const existingTx = await base44.asServiceRole.entities.PointsTransaction.filter({
      relatedEntityId: commentId,
      userId: creatorId,
      action: expectedAction
    });
    if (existingTx.length > 0) {
      return Response.json({ success: true, message: 'Points already adjusted for this comment' });
    }

    // Resolve documentId + build a deep-link URL to the comment.
    // Mirror handleNewComment: for section comments prefer the latest accepted suggestion
    // (so suggestiondetail renders the comments), else fall back to documentview.
    let documentId = null;
    let actionUrl = null;

    if (comment.rootEntityType === 'suggestion') {
      const s = await base44.asServiceRole.entities.Suggestion.filter({ id: comment.rootEntityId });
      if (s.length > 0) {
        documentId = s[0].documentId;
        actionUrl = `/suggestiondetail?id=${s[0].id}&commentId=${comment.id}`;
      }
    } else if (comment.rootEntityType === 'argument') {
      const a = await base44.asServiceRole.entities.Argument.filter({ id: comment.rootEntityId });
      if (a.length > 0) {
        const s = await base44.asServiceRole.entities.Suggestion.filter({ id: a[0].suggestionId });
        if (s.length > 0) {
          documentId = s[0].documentId;
          actionUrl = `/suggestiondetail?id=${s[0].id}&commentId=${comment.id}`;
        }
      }
    } else if (comment.rootEntityType === 'section') {
      const s = await base44.asServiceRole.entities.Section.filter({ id: comment.rootEntityId });
      if (s.length > 0) {
        documentId = s[0].documentId;
        const accepted = await base44.asServiceRole.entities.Suggestion.filter({
          sectionId: comment.rootEntityId,
          status: 'accepted'
        });
        const latestAccepted = accepted.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];
        actionUrl = latestAccepted
          ? `/suggestiondetail?id=${latestAccepted.id}&commentId=${comment.id}`
          : `/documentview?id=${documentId}&commentId=${comment.id}`;
      }
    }

    if (!documentId) return Response.json({ success: true, message: 'No document' });

    const docs = await base44.asServiceRole.entities.Document.filter({ id: documentId });
    if (docs.length === 0 || !docs[0].gamificationEnabled) {
      return Response.json({ success: true, message: 'Gamification not enabled' });
    }

    // Authorization: the caller must be able to access the document the comment
    // belongs to. Without this, any authenticated user could like/unlike comments
    // in private/hidden groups and shift the creator's points.
    const access = await checkDocumentAccess(base44, docs[0], user);
    if (!access.authorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const amount = isLiking ? 5 : -5;
    const action = expectedAction;
    const description = isLiking ? 'Comment like received' : 'Comment like removed';

    const usersList = await base44.asServiceRole.entities.User.filter({ id: creatorId });
    if (usersList.length === 0) return Response.json({ error: 'Creator not found' }, { status: 404 });
    const creator = usersList[0];
    const newPoints = (creator.points || 1000) + amount;

    // Update the likes array server-side (this function owns the transition)
    const updatedLikes = isLiking
      ? [...likes, user.email]
      : likes.filter(e => e !== user.email);

    await Promise.all([
      base44.asServiceRole.entities.User.update(creator.id, { points: newPoints }),
      base44.asServiceRole.entities.Comment.update(commentId, { likes: updatedLikes }),
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