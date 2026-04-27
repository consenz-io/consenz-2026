import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: 5 * 60 * 1000, // 5 minutes global default
			retry: (failureCount, error) => {
				// Never retry on rate limit
				if (error?.status === 429) return false;
				return failureCount < 1;
			},
		},
	},
});