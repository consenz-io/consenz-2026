import { useQuery } from '@tanstack/react-query';
import { userDisplayService } from './service';

/**
 * Hook מרכזי לתצוגת משתמשים
 * שימוש: useUserDisplay(userId) או useUserDisplay({ email: 'user@example.com' })
 */
export function useUserDisplay(idOrOptions) {
  const isEmailQuery = typeof idOrOptions === 'object' && idOrOptions?.email;
  const userId = isEmailQuery ? null : idOrOptions;
  const email = isEmailQuery ? idOrOptions.email : null;

  return useQuery({
    queryKey: isEmailQuery ? ['userDisplay', 'email', email] : ['userDisplay', 'id', userId],
    queryFn: () => {
      if (isEmailQuery) {
        return userDisplayService.getUserByEmail(email);
      }
      return userDisplayService.getUserById(userId);
    },
    enabled: !!(userId || email),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    retry: false,
    placeholderData: null,
  });
}

export function useUsersDisplay(userIds) {
  return useQuery({
    queryKey: ['usersDisplay', userIds?.join(',')],
    queryFn: () => userDisplayService.getUsers(userIds),
    enabled: !!(userIds && userIds.length > 0),
    staleTime: 300000,
    gcTime: 600000,
    retry: false,
    placeholderData: [],
  });
}