import type { AuthTokens } from '@vyra/validation';
import { create } from 'zustand';
import { tokenStorage } from './token-storage';

type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';

interface SessionState {
  readonly status: SessionStatus;
  /** Kept in memory only. */
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  setTokens(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
  markSignedOut(): void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'restoring',
  accessToken: null,
  refreshToken: null,
  async setTokens(tokens) {
    set({ status: 'signedIn', accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    await tokenStorage.write(tokens.refreshToken);
  },
  async clear() {
    set({ status: 'signedOut', accessToken: null, refreshToken: null });
    await tokenStorage.clear();
  },
  markSignedOut() {
    set({ status: 'signedOut', accessToken: null, refreshToken: null });
  },
}));
