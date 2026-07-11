import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

/**
 * Resolves a deep-link URL to a specific comment, mirroring the backend
 * awardCommentLikePoints logic. Used as a fallback for legacy PointsTransaction
 * records that were created before `actionUrl` was stored.
 *
 * @param {string} commentId
 * @returns {Promise<string|null>}
 */
export async function resolveCommentUrl(commentId) {
  if (!commentId) return null;
  try {
    const comments = await base44.entities.Comment.filter({ id: commentId });
    const comment = comments?.[0];
    if (!comment) return null;

    if (comment.rootEntityType === 'suggestion') {
      return `${createPageUrl("suggestiondetail")}?id=${comment.rootEntityId}&commentId=${comment.id}`;
    }

    if (comment.rootEntityType === 'argument') {
      const args = await base44.entities.Argument.filter({ id: comment.rootEntityId });
      const suggestionId = args?.[0]?.suggestionId;
      if (!suggestionId) return null;
      return `${createPageUrl("suggestiondetail")}?id=${suggestionId}&commentId=${comment.id}`;
    }

    if (comment.rootEntityType === 'section') {
      const accepted = await base44.entities.Suggestion.filter({
        sectionId: comment.rootEntityId,
        status: 'accepted',
      });
      const latestAccepted = accepted.sort(
        (a, b) => new Date(b.updated_date) - new Date(a.updated_date)
      )[0];
      if (latestAccepted) {
        return `${createPageUrl("suggestiondetail")}?id=${latestAccepted.id}&commentId=${comment.id}`;
      }
      // Fall back to document view — need documentId from the section
      const sections = await base44.entities.Section.filter({ id: comment.rootEntityId });
      const docId = sections?.[0]?.documentId;
      if (docId) {
        return `${createPageUrl("DocumentView")}?id=${docId}&commentId=${comment.id}`;
      }
    }
  } catch (err) {
    console.error('[resolveCommentUrl]', err);
  }
  return null;
}