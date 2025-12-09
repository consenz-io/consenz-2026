import { base44 } from "@/api/base44Client";

/**
 * Ensures that a UserPublicProfile exists for the given user.
 * If it doesn't exist, creates one.
 * This should be called after any user action that makes them a "contributor"
 * (creating suggestions, comments, votes, etc.)
 */
export async function ensureUserPublicProfile(user) {
  if (!user || !user.id || !user.email) {
    return;
  }

  try {
    const fullName = user.full_name?.trim() || '';
    
    // Only create/update if user has a valid name
    if (!fullName || fullName.length < 2) {
      return;
    }

    // Check if profile already exists
    const existingProfiles = await base44.entities.UserPublicProfile.filter({ userId: user.id });
    
    if (existingProfiles.length === 0) {
      // Create new profile
      await base44.entities.UserPublicProfile.create({
        userId: user.id,
        email: user.email,
        fullName: fullName
      });
    } else {
      // Update existing profile to ensure sync
      const existingProfile = existingProfiles[0];
      if (existingProfile.fullName !== fullName || existingProfile.email !== user.email) {
        await base44.entities.UserPublicProfile.update(existingProfile.id, {
          fullName: fullName,
          email: user.email
        });
      }
    }
  } catch (err) {
    console.error('Error ensuring UserPublicProfile:', err);
    // Don't throw - this is a background operation
  }
}