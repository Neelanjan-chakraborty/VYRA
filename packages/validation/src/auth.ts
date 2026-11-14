import { z } from 'zod';
import { MINIMUM_AGE_YEARS } from './domain.js';

export const otpChannelSchema = z.enum(['email', 'phone']);
export type OtpChannel = z.infer<typeof otpChannelSchema>;

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .transform((value) => value.toLowerCase())
  .pipe(z.email('Enter a valid e-mail address'));

/** E.164, e.g. +919876543210. Spaces, dashes and brackets are stripped first. */
export const phoneSchema = z
  .string()
  .transform((value) => value.replaceAll(/[\s\-().]/g, ''))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a phone number with its country code'));

export const otpRequestSchema = z.discriminatedUnion('channel', [
  z.object({ channel: z.literal('email'), destination: emailSchema }),
  z.object({ channel: z.literal('phone'), destination: phoneSchema }),
]);
export type OtpRequest = z.input<typeof otpRequestSchema>;

export const OTP_LENGTH = 6;
export const otpCodeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const otpRequestResponseSchema = z.object({
  challengeId: z.uuid(),
  expiresInSeconds: z.number().int().positive(),
  /** Present only when the API runs with the development OTP sender. */
  devCode: otpCodeSchema.optional(),
});
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;

const otpProof = { challengeId: z.uuid(), code: otpCodeSchema };
/** The destination is sent again because the server stores only a hash of it. */
export const otpVerifySchema = z.discriminatedUnion('channel', [
  z.object({ channel: z.literal('email'), destination: emailSchema, ...otpProof }),
  z.object({ channel: z.literal('phone'), destination: phoneSchema, ...otpProof }),
]);
export type OtpVerify = z.input<typeof otpVerifySchema>;

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  accessTokenExpiresInSeconds: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

/**
 * Verifying a code either signs an existing person in, or — for a new
 * destination — returns a short-lived token that must be exchanged at
 * `/auth/register` together with a date of birth and consent.
 */
export const otpVerifyResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('authenticated'), tokens: authTokensSchema }),
  z.object({ status: z.literal('registration_required'), registrationToken: z.string().min(1) }),
]);
export type OtpVerifyResponse = z.infer<typeof otpVerifyResponseSchema>;

/** Whole years between a calendar date of birth and `now` (UTC). */
export function ageInYears(dateOfBirth: string, now: Date = new Date()): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number) as [number, number, number];
  let age = now.getUTCFullYear() - year;
  const beforeBirthday =
    now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

export const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Enter a real date')
  .refine((value) => ageInYears(value) <= 120, 'Enter a real date');

/** Versions of the legal documents currently in force. */
export const CURRENT_TERMS_VERSION = '2026-11';
export const CURRENT_PRIVACY_VERSION = '2026-11';

export const registerSchema = z.object({
  registrationToken: z.string().min(1),
  dateOfBirth: dateOfBirthSchema,
  acceptedTermsVersion: z.literal(CURRENT_TERMS_VERSION),
  acceptedPrivacyVersion: z.literal(CURRENT_PRIVACY_VERSION),
});
export type RegisterRequest = z.infer<typeof registerSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(200) });
export type RefreshRequest = z.infer<typeof refreshSchema>;

export { MINIMUM_AGE_YEARS };
