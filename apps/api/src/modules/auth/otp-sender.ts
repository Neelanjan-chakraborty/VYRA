import type { OtpChannel } from '@vyra/validation';

export const OTP_SENDER = Symbol('OTP_SENDER');

export interface OtpSender {
  /** True when the code may be handed back to the caller instead of being delivered. */
  readonly revealsCode: boolean;
  send(channel: OtpChannel, destination: string, code: string): Promise<void>;
}

/**
 * Development stand-in: delivers nothing and logs nothing. The API returns the
 * code in the response instead. Configuration validation refuses it in production.
 */
export class DevOtpSender implements OtpSender {
  readonly revealsCode = true;

  async send(): Promise<void> {
    // Intentionally empty.
  }
}
