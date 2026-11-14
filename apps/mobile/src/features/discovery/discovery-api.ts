import { useQuery } from '@tanstack/react-query';
import {
  compatibilityViewSchema,
  criteriaImpactSchema,
  publicProfileSchema,
  recommendationListSchema,
} from '@vyra/validation';
import { api } from '@/lib/api';

export function useRecommendations() {
  return useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api('/discovery/recommendations?limit=30', { schema: recommendationListSchema }),
    // Photo URLs are signed for ten minutes.
    staleTime: 3 * 60_000,
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
