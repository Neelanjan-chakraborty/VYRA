import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@vyra/validation';
import { apiGet } from '@/lib/api';

export function useApiHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    // 503 still carries a valid health body describing which dependency is down.
    queryFn: () => apiGet('/health', healthResponseSchema, { acceptStatuses: [503] }),
    refetchInterval: 30_000,
  });
}
