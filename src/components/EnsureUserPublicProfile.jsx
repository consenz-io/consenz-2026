import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Component to ensure UserPublicProfile exists for logged-in users
 * This runs automatically on app load and creates the profile if missing
 */
export default function EnsureUserPublicProfile({ user }) {
  const queryClient = useQueryClient();

  const { data: existingProfile } = useQuery({
    queryKey: ['userPublicProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const profiles = await base44.entities.UserPublicProfile.filter({ userId: user.id });
      return profiles.length > 0 ? profiles[0] : null;
    },
    enabled: !!user?.id,
    staleTime: 300000, // 5 minutes
  });

  const createProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !user?.email || !user?.full_name) return;
      
      // Double-check if profile exists
      const existing = await base44.entities.UserPublicProfile.filter({ userId: user.id });
      if (existing.length > 0) return;
      
      // Create public profile
      await base44.entities.UserPublicProfile.create({
        userId: user.id,
        email: user.email,
        fullName: user.full_name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPublicProfile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['publicProfiles'] });
    },
  });

  useEffect(() => {
    if (user?.id && user?.email && user?.full_name && existingProfile === null) {
      createProfileMutation.mutate();
    }
  }, [user?.id, existingProfile]);

  return null; // This is a utility component with no UI
}