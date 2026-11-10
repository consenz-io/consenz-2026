import { base44 } from "@/api/base44Client";

// Notifications linked to a suggestion stay stored after the suggestion is
// deleted (history is preserved), but they must no longer appear in any
// notification feed. We resolve which linked suggestions still exist and drop
// the notifications pointing at the ones that are gone.
export async function filterDeletedSuggestionNotifications(notifications) {
  if (!notifications || notifications.length === 0) return notifications || [];

  const suggestionIds = [
    ...new Set(
      notifications
        .filter((n) => n.relatedEntityType === "suggestion" && n.relatedEntityId)
        .map((n) => n.relatedEntityId)
    ),
  ];

  if (suggestionIds.length === 0) return notifications;

  // The API rejects the whole query if any id is malformed, so only real
  // record ids are looked up. Anything else cannot be an existing suggestion.
  const validSuggestionIds = suggestionIds.filter((id) => /^[0-9a-fA-F]{24}$/.test(id));

  const existingSuggestionIds = new Set();
  try {
    if (validSuggestionIds.length > 0) {
      const existing = await base44.entities.Suggestion.filter({ id: { $in: validSuggestionIds } });
      (existing || []).forEach((s) => existingSuggestionIds.add(s.id));
    }
  } catch (error) {
    // A failed lookup must never empty the feed — show the notifications as-is.
    console.error("[NOTIFICATIONS] Could not verify suggestion links:", error);
    return notifications;
  }

  return notifications.filter(
    (n) =>
      !(
        n.relatedEntityType === "suggestion" &&
        n.relatedEntityId &&
        !existingSuggestionIds.has(n.relatedEntityId)
      )
  );
}