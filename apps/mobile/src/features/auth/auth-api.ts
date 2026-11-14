import {
  authTokensSchema,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  otpRequestResponseSchema,
  otpVerifyResponseSchema,
  type OtpChannel,
} from '@vyra/validation';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useSession } from '@/lib/session';
import { useAuthFlow } from './auth-flow';

export function requestCode(channel: OtpChannel, destination: string) {
  return api('/auth/otp/request', {
    method: 'POST',
    body: { channel, destination },
    schema: otpRequestResponseSchema,
    authenticated: false,
  });
}

export function verifyCode(input: {
  channel: OtpChannel;
  destination: string;
  challengeId: string;
  code: string;
}) {
  return api('/auth/otp/verify', {
    method: 'POST',
    body: input,
    schema: otpVerifyResponseSchema,
    authenticated: false,
  });
}

export function register(registrationToken: string, dateOfBirth: string) {
  return api('/auth/register', {
    method: 'POST',
    body: {
      registrationToken,
      dateOfBirth,
      acceptedTermsVersion: CURRENT_TERMS_VERSION,
      acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
    },
    schema: authTokensSchema,
    authenticated: false,
  });
}

/** Ends the session on the server (best effort) and clears everything held locally. */
export async function signOut(): Promise<void> {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
  await useSession.getState().clear();
  useAuthFlow.getState().reset();
  queryClient.clear();
}
