import { useEffect } from 'react';
import { useMe } from '@/features/profile/profile-api';
import { refreshSession } from '@/lib/api';
import { useSession } from '@/lib/session';

export type AppPhase = 'loading' | 'signedOut' | 'onboarding' | 'active' | 'unavailable';

/**
 * The single source of truth for which part of the app a person may see.
 * On launch it tries to restore a session from the stored refresh token.
 */
export function useAppPhase(): AppPhase {
  const status = useSession((state) => state.status);
  const me = useMe();

  useEffect(() => {
    if (useSession.getState().status !== 'restoring') return;
    void refreshSession().then((restored) => {
      if (!restored && useSession.getState().status === 'restoring') {
        useSession.getState().markSignedOut();
      }
    });
  }, []);

  if (status === 'restoring') return 'loading';
  if (status === 'signedOut') return 'signedOut';
  if (me.data) return me.data.status === 'ONBOARDING' ? 'onboarding' : 'active';
  if (me.isError) return 'unavailable';
  return 'loading';
}
