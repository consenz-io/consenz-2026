import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * OPTIMIZATION: Single, centralized currentUser query.
 * Prevents 5+ redundant queries across multiple components.
 * StaleTime: 5min (auth doesn't change every render)
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}