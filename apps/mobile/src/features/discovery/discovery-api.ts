import { useMutation, useQuery } from '@tanstack/react-query';
import {
  blockedListSchema,
  compatibilityViewSchema,
  connectionsSchema,
  connectResultSchema,
  relationshipStateSchema,
  type ReportRequest,
  criteriaImpactSchema,
  publicProfileSchema,
  recommendationListSchema,
} from '@vyra/validation';
import { api } from '@/lib/api';
import { MEDIA_REFRESH_MS, queryClient } from '@/lib/query-client';

export function useRecommendations() {
  return useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api('/discovery/recommendations?limit=30', { schema: recommendationListSchema }),
    // Photo URLs are signed for ten minutes.
    staleTime: 3 * 60_000,
    refetchInterval: MEDIA_REFRESH_MS,
  });
}

export function useCriteriaImpact() {
  return useQuery({
    queryKey: ['criteria-impact'],
    queryFn: () => api('/discovery/criteria-impact', { schema: criteriaImpactSchema }),
    staleTime: 60_000,
  });
}

export function usePublicProfile(userId: string) {
  return useQuery({
    queryKey: ['people', userId],
    queryFn: () => api(`/people/${userId}`, { schema: publicProfileSchema }),
    staleTime: 3 * 60_000,
    refetchInterval: MEDIA_REFRESH_MS,
  });
}

export function useCompatibility(userId: string) {
  return useQuery({
    queryKey: ['compatibility', userId],
    queryFn: () => api(`/compatibility/${userId}`, { schema: compatibilityViewSchema }),
    staleTime: 3 * 60_000,
  });
}

/** Estimated alignment in words. Never presented as a prediction. */
export function alignmentWords(overall: number | null): string {
  if (overall === null) return 'Not enough to say yet';
  if (overall >= 0.75) return 'Strong estimated alignment';
  if (overall >= 0.6) return 'Good estimated alignment';
  if (overall >= 0.45) return 'Some estimated alignment';
  return 'Low estimated alignment';
}

/** How much the estimate rests on, in words. */
export function confidenceWords(confidence: number): string {
  if (confidence >= 0.7) return 'Based on a fair amount';
  if (confidence >= 0.4) return 'Based on some of what you’ve both shared';
  return 'Based on very little so far';
}

// ─────────────────────────── connections ───────────────────────────

/**
 * Anything that changes who you're connected with refreshes every view of it. After a
 * block the person's own profile would now be a 404, so it isn't re-fetched while the
 * screen closes; its cache entry is collected once nothing shows it.
 */
function refreshPeople(userId?: string, gone = false): void {
  for (const key of [['recommendations'], ['connections'], ['criteria-impact'], ['blocks']]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
  if (!userId || gone) return;
  for (const key of [
    ['relationship', userId],
    ['people', userId],
    ['compatibility', userId],
  ]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

export function useConnections() {
  return useQuery({
    queryKey: ['connections'],
    queryFn: () => api('/connections', { schema: connectionsSchema }),
    staleTime: 30_000,
    refetchInterval: MEDIA_REFRESH_MS,
  });
}

export function useRelationship(userId: string, enabled = true) {
  return useQuery({
    queryKey: ['relationship', userId],
    enabled: enabled && userId.length > 0,
    queryFn: () => api(`/people/${userId}/relationship`, { schema: relationshipStateSchema }),
  });
}

export function useSave() {
  return useMutation({
    mutationFn: ({ userId, saved }: { userId: string; saved: boolean }) =>
      api(`/saved/${userId}`, { method: saved ? 'PUT' : 'DELETE' }),
    onSuccess: (_data, { userId }) => refreshPeople(userId),
  });
}

export function usePass() {
  return useMutation({
    mutationFn: (userId: string) => api(`/discovery/pass/${userId}`, { method: 'POST' }),
    onSuccess: (_data, userId) => refreshPeople(userId),
  });
}

export function useConnect() {
  return useMutation({
    mutationFn: (input: { recipientId: string; note?: string }) =>
      api('/connections/requests', { method: 'POST', body: input, schema: connectResultSchema }),
    onSuccess: (_data, { recipientId }) => refreshPeople(recipientId),
  });
}

export function useRespond() {
  return useMutation({
    mutationFn: ({
      requestId,
      action,
    }: {
      requestId: string;
      action: 'accept' | 'decline' | 'withdraw';
      userId: string;
    }) => api(`/connections/requests/${requestId}/${action}`, { method: 'POST' }),
    onSuccess: (_data, { userId }) => refreshPeople(userId),
  });
}

export function useEndConnection() {
  return useMutation({
    mutationFn: ({ matchId }: { matchId: string; userId: string }) =>
      api(`/connections/matches/${matchId}`, { method: 'DELETE' }),
    onSuccess: (_data, { userId }) => refreshPeople(userId),
  });
}

export function useBlocked() {
  return useQuery({
    queryKey: ['blocks'],
    queryFn: () => api('/blocks', { schema: blockedListSchema }),
  });
}

export function useBlock() {
  return useMutation({
    mutationFn: ({ userId, blocked }: { userId: string; blocked: boolean }) =>
      api(`/blocks/${userId}`, { method: blocked ? 'POST' : 'DELETE' }),
    onSuccess: (_data, { userId, blocked }) => refreshPeople(userId, blocked),
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (report: ReportRequest) => api('/reports', { method: 'POST', body: report }),
  });
}
