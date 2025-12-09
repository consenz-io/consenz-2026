import { base44 } from '@/api/base44Client';

/**
 * UserDisplayService - Single Source of Truth למידע על משתמשים
 */
class UserDisplayService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * נרמול אובייקט משתמש לפורמט אחיד
   */
  normalize(userOrProfile) {
    if (!userOrProfile) return null;

    const displayName = userOrProfile.full_name || userOrProfile.fullName || 'User';

    return {
      id: userOrProfile.userId || userOrProfile.id,
      email: userOrProfile.email,
      displayName: displayName.trim(),
      initials: this.getInitials(displayName),
      isAdmin: userOrProfile.role === 'admin',
      bio: userOrProfile.bio || null,
      socialLinks: {
        linkedin: userOrProfile.linkedin || null,
        twitter: userOrProfile.twitter || null,
        facebook: userOrProfile.facebook || null,
        instagram: userOrProfile.instagram || null,
        website: userOrProfile.website || null,
      },
      points: userOrProfile.points || null,
    };
  }

  getInitials(name) {
    if (!name || typeof name !== 'string') return '?';
    const trimmed = name.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0).toUpperCase() + parts[parts.length - 1].charAt(0).toUpperCase());
  }

  async getUserById(userId) {
    if (!userId) return null;

    const cacheKey = `user-${userId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Strategy 1: Try UserPublicProfile (accessible to everyone)
      const profiles = await base44.entities.UserPublicProfile.filter({ userId });
      if (profiles && profiles.length > 0) {
        const normalized = this.normalize(profiles[0]);
        this.cache.set(cacheKey, normalized);
        return normalized;
      }

      // Strategy 2: Fallback to User entity (admin only)
      try {
        const users = await base44.entities.User.filter({ id: userId });
        if (users && users.length > 0) {
          const normalized = this.normalize(users[0]);
          this.cache.set(cacheKey, normalized);
          return normalized;
        }
      } catch (error) {
        // Expected for non-admins
        console.debug('[UserDisplayService] User entity not accessible (not admin)');
      }

      console.warn('[UserDisplayService] No data found for userId:', userId);
      return null;
    } catch (error) {
      console.error('[UserDisplayService] Error loading user by ID:', error);
      return null;
    }
  }

  async getUserByEmail(email) {
    if (!email) return null;

    const cacheKey = `email-${email}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const profiles = await base44.entities.UserPublicProfile.filter({ email });
      if (profiles && profiles.length > 0) {
        const normalized = this.normalize(profiles[0]);
        this.cache.set(cacheKey, normalized);
        return normalized;
      }

      try {
        const users = await base44.entities.User.filter({ email });
        if (users && users.length > 0) {
          const normalized = this.normalize(users[0]);
          this.cache.set(cacheKey, normalized);
          return normalized;
        }
      } catch (error) {
        console.debug('[UserDisplayService] User entity not accessible (not admin)');
      }

      console.warn('[UserDisplayService] No data found for email:', email);
      return null;
    } catch (error) {
      console.error('[UserDisplayService] Error loading user by email:', error);
      return null;
    }
  }

  async getUsers(userIds) {
    if (!userIds || userIds.length === 0) return [];
    try {
      const results = await Promise.all(userIds.map(id => this.getUserById(id)));
      return results.filter(Boolean);
    } catch (error) {
      console.error('[UserDisplayService] Error loading multiple users:', error);
      return [];
    }
  }

  clearCache(userId) {
    if (userId) {
      this.cache.delete(`user-${userId}`);
      const user = this.cache.get(`user-${userId}`);
      if (user?.email) {
        this.cache.delete(`email-${user.email}`);
      }
    } else {
      this.cache.clear();
    }
  }

  async ensurePublicProfile(user) {
    if (!user || !user.id || !user.email) {
      console.warn('[UserDisplayService] Cannot ensure profile - missing data');
      return;
    }

    try {
      const fullName = user.full_name || user.name || '';
      if (!fullName || fullName.trim().length < 2) {
        console.warn('[UserDisplayService] Cannot create profile - name too short');
        return;
      }

      const existingProfiles = await base44.entities.UserPublicProfile.filter({ userId: user.id });
      const profileData = {
        userId: user.id,
        email: user.email,
        full_name: fullName.trim(),
      };

      if (existingProfiles.length === 0) {
        await base44.entities.UserPublicProfile.create(profileData);
        console.log('[UserDisplayService] Created public profile for:', user.email);
      } else {
        const existingProfile = existingProfiles[0];
        if (existingProfile.full_name !== fullName.trim()) {
          await base44.entities.UserPublicProfile.update(existingProfile.id, profileData);
          console.log('[UserDisplayService] Updated public profile for:', user.email);
        }
      }

      this.clearCache(user.id);
    } catch (error) {
      console.error('[UserDisplayService] Error ensuring public profile:', error);
    }
  }
}

export const userDisplayService = new UserDisplayService();