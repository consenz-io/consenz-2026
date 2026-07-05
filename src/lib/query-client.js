import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: 5 * 60 * 1000, // 5 minutes global default
			retry: (failureCount, error) => {
				// Never retry on rate-limit or auth errors — retrying won't help
				const status = error?.status;
				if (status === 429 || status === 401 || status === 403) return false;
				// Transient failures (500, network, timeout) — retry up to 3 times
				return failureCount < 3;
			},
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
		},
	},
});