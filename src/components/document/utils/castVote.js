import { base44 } from "@/api/base44Client";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";

/**
 * Shared server-side vote logic used by all vote paths:
 * DocumentView (SectionCarousel), SuggestionDetail, and SuggestionSidebar.
 *
 * Calls voteOnSuggestionV2 which internally invokes processAcceptanceV4
 * (with the internal automation token) when the vote threshold is met.
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

  return { accepted, newProVotes, newConVotes, voteAction };
}