import { base44 } from "@/api/base44Client";

/**
 * Ensures that a UserPublicProfile exists for the given user.
 * Creates one if it doesn't exist.
 * This should be called whenever a user performs any contribution action.
 */
export async function ensureUserPublicProfile(user) {
  if (!user || !user.id || !user.email) {
    return;
  }

  try {
    // Check if profile exists
    const existingProfiles = await base44.entities.UserPublicProfile.filter({ 
      userId: user.id 
    });

    const fullName = user.full_name || user.name || '';
    
    if (existingProfiles.length === 0) {
      // Create new profile if user has a valid name
      if (fullName && fullName.trim().length >= 2) {
        await base44.entities.UserPublicProfile.create({
          userId: user.id,
          email: user.email,
          full_name: fullName.trim()
        });
      }
    } else {
      // Update existing profile to ensure sync
      const existingProfile = existingProfiles[0];
      const trimmedFullName = fullName.trim();
      if (trimmedFullName.length >= 2 && trimmedFullName !== existingProfile.full_name) {
        await base44.entities.UserPublicProfile.update(existingProfile.id, {
          full_name: trimmedFullName,
          email: user.email
        });
      }
    }
  } catch (err) {
    console.error('[ensureUserPublicProfile] Error:', err);
  }
}