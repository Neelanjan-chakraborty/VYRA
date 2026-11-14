import { describe, expect, it } from 'vitest';
import {
  ageInYears,
  dateOfBirthSchema,
  emailSchema,
  otpRequestSchema,
  phoneSchema,
} from './auth.js';
import {
  discoveryPreferencesSchema,
  profileUpdateSchema,
  relationshipIntentsUpdateSchema,
} from './me.js';

describe('contact normalisation', () => {
  it('lower-cases and trims e-mail', () => {
    expect(emailSchema.parse('  Asha@Example.COM ')).toBe('asha@example.com');
  });
  it('rejects malformed e-mail', () => {
    expect(emailSchema.safeParse('asha@').success).toBe(false);
  });
  it('strips formatting from phone numbers', () => {
    expect(phoneSchema.parse('+91 98765-43210')).toBe('+919876543210');
  });
  it.each(['9876543210', '+0123456789', '+91abc', '+1'])('rejects phone %s', (value) => {
    expect(phoneSchema.safeParse(value).success).toBe(false);
  });
  it('validates the destination against its channel', () => {
    expect(otpRequestSchema.safeParse({ channel: 'phone', destination: 'a@b.co' }).success).toBe(
      false,
    );
    expect(otpRequestSchema.safeParse({ channel: 'email', destination: 'a@b.co' }).success).toBe(
      true,
    );
  });
});

describe('age', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  it('counts whole years, birthday inclusive', () => {
    expect(ageInYears('2008-11-14', now)).toBe(18);
    expect(ageInYears('2008-11-15', now)).toBe(17);
    expect(ageInYears('2000-02-29', now)).toBe(26);
  });
  it.each(['2026-13-01', '2001-02-30', '14-11-2000', '1800-01-01'])('rejects %s', (value) => {
    expect(dateOfBirthSchema.safeParse(value).success).toBe(false);
  });
});

describe('profile and preferences', () => {
  it('turns empty optional text into null', () => {
    expect(profileUpdateSchema.parse({ bio: '   ' })).toEqual({ bio: null });
  });
  it('rejects an empty display name', () => {
    expect(profileUpdateSchema.safeParse({ displayName: '  ' }).success).toBe(false);
  });
  it('requires a label only for "other"', () => {
    const ok = {
      intents: [
        { kind: 'other', customLabel: 'Pen pals' },
        { kind: 'serious', isPrimary: true },
      ],
    };
    expect(relationshipIntentsUpdateSchema.safeParse(ok).success).toBe(true);
    expect(
      relationshipIntentsUpdateSchema.safeParse({ intents: [{ kind: 'other' }] }).success,
    ).toBe(false);
    expect(
      relationshipIntentsUpdateSchema.safeParse({ intents: [{ kind: 'casual', customLabel: 'x' }] })
        .success,
    ).toBe(false);
  });
  it('rejects duplicate kinds and two primaries', () => {
    expect(
      relationshipIntentsUpdateSchema.safeParse({
        intents: [{ kind: 'casual' }, { kind: 'casual' }],
      }).success,
    ).toBe(false);
    expect(
      relationshipIntentsUpdateSchema.safeParse({
        intents: [
          { kind: 'casual', isPrimary: true },
          { kind: 'serious', isPrimary: true },
        ],
      }).success,
    ).toBe(false);
  });
  it('rejects under-18 and inverted age ranges', () => {
    const base = { maxDistanceKm: null, showGenders: [], showAstrology: false };
    expect(discoveryPreferencesSchema.safeParse({ ...base, minAge: 17, maxAge: 30 }).success).toBe(
      false,
    );
    expect(discoveryPreferencesSchema.safeParse({ ...base, minAge: 30, maxAge: 25 }).success).toBe(
      false,
    );
    expect(discoveryPreferencesSchema.safeParse({ ...base, minAge: 21, maxAge: 35 }).success).toBe(
      true,
    );
  });
});
