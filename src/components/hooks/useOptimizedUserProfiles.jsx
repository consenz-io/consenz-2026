import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { userProfileCache } from '@/components/utils/cache';
import { queryKeys, QUERY_STALE_TIMES } from '@/components/config/queryConfig';

// Optimized hook for fetching user profiles with caching
export function useOptimizedUserProfiles() {
  return useQuery({
    queryKey: queryKeys.publicProfiles,
    queryFn: async () => {
      const profiles = await base44.entities.UserPublicProfile.list();
      
      // Cache each profile individually
      profiles.forEach(profile => {
        userProfileCache.set(profile.userId, profile);
        userProfileCache.setByEmail(profile.email, profile);
      });
      
      return profiles;
    },
    staleTime: QUERY_STALE_TIMES.PUBLIC_PROFILES,
    cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

// Get a single user profile (checks cache first)
export function useUserProfile(userId) {
  return useQuery({
    queryKey: queryKeys.userProfile(userId),
    queryFn: async () => {
      // Check cache first
      const cached = userProfileCache.get(userId);
      if (cached) return cached;

      // Fetch from API
      const profiles = await base44.entities.UserPublicProfile.filter({ userId });
      const profile = profiles[0] || null;
      
      if (profile) {
        userProfileCache.set(userId, profile);
      }
      
      return profile;
    },
    enabled: !!userId,
    staleTime: QUERY_STALE_TIMES.USER_PROFILE,
  });
}