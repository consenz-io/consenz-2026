import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { userProfileCache } from '@/components/utils/cache';
import { queryKeys, QUERY_STALE_TIMES } from '@/components/config/queryConfig';

// Cache-only read — does NOT fetch. The ['publicProfiles'] cache is seeded by
// page-scoped targeted fetches (useDocumentData, useHomeData, etc.) and per-page
// targeted fetches (e.g. suggestiondetail's chain-author fetch). This avoids
// loading up to 1000 profiles into memory on every consumer mount.
export function useOptimizedUserProfiles() {
  return useQuery({
    queryKey: queryKeys.publicProfiles,
    queryFn: () => [],
    enabled: false,
    staleTime: QUERY_STALE_TIMES.PUBLIC_PROFILES,
    gcTime: 30 * 60 * 1000,
    initialData: [],
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