import { useMutation, useQuery } from '@tanstack/react-query';
import { locationViewSchema, placeListSchema, type LocationUpdate } from '@vyra/validation';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';

function refresh(): Promise<void> {
  // Location changes who is recommended and how far away they are.
  void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
  return queryClient.invalidateQueries({ queryKey: ['me'] });
}

export function useSetLocation() {
  return useMutation({
    mutationFn: (update: LocationUpdate) =>
      api('/me/location', { method: 'PUT', body: update, schema: locationViewSchema }),
    onSuccess: refresh,
  });
}

export function useClearLocation() {
  return useMutation({
    mutationFn: () => api('/me/location', { method: 'DELETE' }),
    onSuccess: refresh,
  });
}

export function usePlaces(query: string, countryCode = 'IN') {
  return useQuery({
    queryKey: ['places', countryCode, query],
    queryFn: () =>
      api(`/places?country=${countryCode}&q=${encodeURIComponent(query)}`, {
        schema: placeListSchema,
      }),
    staleTime: 60 * 60_000,
  });
}
