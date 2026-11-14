import type { OtpChannel } from '@vyra/validation';
import { create } from 'zustand';

interface AuthFlowState {
  readonly channel: OtpChannel;
  readonly destination: string;
  readonly challengeId: string | null;
  /** Only ever set by a development API. */
  readonly devCode: string | null;
  readonly registrationToken: string | null;
  readonly dateOfBirth: string | null;
  update(patch: Partial<Omit<AuthFlowState, 'update' | 'reset'>>): void;
  reset(): void;
}

const initial = {
  channel: 'phone' as OtpChannel,
  destination: '',
  challengeId: null,
  devCode: null,
  registrationToken: null,
  dateOfBirth: null,
};

/** Carries sign-in state between the auth screens. In memory only. */
export const useAuthFlow = create<AuthFlowState>((set) => ({
  ...initial,
  update: (patch) => set(patch),
  reset: () => set(initial),
}));
