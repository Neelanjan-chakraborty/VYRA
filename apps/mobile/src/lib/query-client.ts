import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';

/**
 * Photo and voice URLs from the API are signed for ten minutes. Queries that
 * carry them refetch on this interval while on screen, so nothing shown ever
 * points at an expired URL.
 */
export const MEDIA_REFRESH_MS = 5 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry transient failures only; a 4xx will not fix itself.
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(error instanceof ApiRequestError && error.status !== undefined && error.status < 500),
    },
  },
});
