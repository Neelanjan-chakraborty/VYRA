import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
  meSchema,
  resolvedPersonSchema,
  searchResultsSchema,
  usernameCheckSchema,
} from '@vyra/validation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MEDIA_REFRESH_MS, queryClient } from '@/lib/query-client';

/** The value, but only once it has stopped changing for `delayMs`. */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

export function useSearchPeople(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['search', q],
    queryFn: () =>
      api(`/search/people?q=${encodeURIComponent(q)}&limit=15`, { schema: searchResultsSchema }),
    enabled: q.length >= 2,
    // Photo URLs are signed for ten minutes.
    staleTime: 30_000,
    refetchInterval: MEDIA_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

export function useUsernameCheck(username: string) {
  const name = username.trim();
  return useQuery({
    queryKey: ['username-check', name],
    queryFn: () =>
      api(`/me/username/check?username=${encodeURIComponent(name)}`, {
        schema: usernameCheckSchema,
      }),
    enabled: name.length > 0,
    staleTime: 10_000,
  });
}

export function useSetUsername() {
  return useMutation({
    mutationFn: (username: string) =>
      api('/me/username', { method: 'PUT', body: { username }, schema: meSchema }),
    onSuccess: (me) => {
      queryClient.setQueryData(['me'], me);
      void queryClient.invalidateQueries({ queryKey: ['username-check'] });
    },
  });
}

/** The person behind a shared username, if the signed-in person may see them. */
export function useResolveUsername(username: string) {
  return useQuery({
    queryKey: ['resolve-username', username],
    queryFn: () =>
      api(`/people/by-username/${encodeURIComponent(username)}`, { schema: resolvedPersonSchema }),
    enabled: username.length > 0,
    retry: false,
    staleTime: 60_000,
  });
}
