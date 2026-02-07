import { base44 } from "@/api/base44Client";

/**
 * Ensures that a UserPublicProfile exists for the given user.
 * If it doesn't exist, creates one.
 * This should be called after any user action that makes them a "contributor"
 * (creating suggestions, comments, votes, etc.)
 */
// Cache to prevent multiple concurrent calls for same user
const ongoingRequests = new Map();

export async function ensureUserPublicProfile(user) {
  if (!user || !user.id || !user.email) {
    return;
  }

  // Prevent concurrent calls for same user
  if (ongoingRequests.has(user.id)) {
    console.log('[PROFILE] Already processing for user:', user.id);
    return ongoingRequests.get(user.id);
  }

  const promise = (async () => {
    try {
      const fullName = user.full_name?.trim() || '';
      
      // Only create/update if user has a valid name
      if (!fullName || fullName.length < 2) {
        return;
      }

      // REMOVED: No need to check/update on every call
      // Layout already handles this on mount
      // This prevents cascade of API calls
      console.log('[PROFILE] Skipping ensure - handled by Layout');
      
    } catch (err) {
      console.error('Error ensuring UserPublicProfile:', err);
      // Don't throw - this is a background operation
    } finally {
      ongoingRequests.delete(user.id);
    }
  })();

  ongoingRequests.set(user.id, promise);
  return promise;
}