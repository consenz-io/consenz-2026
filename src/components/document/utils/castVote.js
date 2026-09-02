import { base44 } from "@/api/base44Client";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";

/**
 * Shared server-side vote logic used by all vote paths:
 * DocumentView (SectionCarousel), SuggestionDetail, and SuggestionSidebar.
 *
 * Calls voteOnSuggestionV2 → processAcceptanceV4 (with fallback when the vote
 * reached threshold but acceptance didn't process — the deployed processAcceptance
 * may be stale due to a read-after-write lock bug).
 *
 * @returns { accepted, newProVotes, newConVotes, voteAction }
 */
export async function castVote({ suggestionId, vote, document, user }) {
  if (!user) throw new Error("יש להתחבר כדי להצביע");

  const response = await base44.functions.invoke("voteOnSuggestionV2", {
    suggestionId,
    vote,
  });

  if (!response.data.success) {
    throw new Error(response.data.error || "שגיאה בהצבעה");
  }

  const { newProVotes, newConVotes, accepted, voteAction } = response.data;

  // Ensure public profile exists for new voters
  if (voteAction === "created") {
    ensureUserPublicProfile(user).catch(() => {});
  }

  // Fallback: if vote reached threshold but acceptance didn't process
  const delta = (newProVotes || 0) - (newConVotes || 0);
  const threshold = Math.max(2, document?.threshold || 2);
  if (!accepted && delta >= threshold) {
    try {
      const fallbackRes = await base44.functions.invoke("processAcceptanceV4", {
        suggestionId,
        documentId: document?.id,
        voterId: user.id,
        wasNewVote: voteAction === "created",
        forceReleaseLock: true,
      });
      const fallbackData = fallbackRes?.data || fallbackRes;
      if (fallbackData?.accepted || fallbackData?.message === "Already processed") {
        return { accepted: true, newProVotes, newConVotes, voteAction };
      }
    } catch (fallbackErr) {
      console.error("[VOTE] processAcceptanceV4 fallback error:", fallbackErr);
    }
  }

  return { accepted, newProVotes, newConVotes, voteAction };
}