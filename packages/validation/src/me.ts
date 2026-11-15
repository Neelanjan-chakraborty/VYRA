import { z } from 'zod';
import { categoryListSchema, criteriaListSchema, genderIdentitySchema } from './compatibility.js';
import { relationshipIntentSchema } from './domain.js';
import { locationViewSchema } from './location.js';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
/** Optional text field: empty string or null clears it. */
const clearable = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .transform((value) => (value === null || value === '' ? null : value));

export const PROFILE_LIMITS = {
  displayName: 60,
  bio: 600,
  short: 40,
  occupation: 80,
  city: 80,
} as const;
export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_INTERESTS = 20;

export const profileUpdateSchema = z
  .object({
    displayName: trimmed(PROFILE_LIMITS.displayName),
    bio: clearable(PROFILE_LIMITS.bio),
    /** null clears the answer. */
    genderIdentity: z.union([genderIdentitySchema, z.null()]),
    /** Only kept with SELF_DESCRIBE. */
    genderSelfDescription: clearable(PROFILE_LIMITS.short),
    /** Show the gender on the profile. Off unless the person turns it on. */
    genderVisible: z.boolean(),
    /** SELF_DESCRIBE only: which searches to appear in. Empty = shown to people who include unlisted genders. */
    discoverableAs: categoryListSchema,
    pronouns: clearable(PROFILE_LIMITS.short),
    occupation: clearable(PROFILE_LIMITS.occupation),
    isDiscoverable: z.boolean(),
    /** Push notifications for new messages / connection requests. */
    notifyMessages: z.boolean(),
    notifyRequests: z.boolean(),
  })
  .partial();
export type ProfileUpdate = z.input<typeof profileUpdateSchema>;

export const relationshipIntentInputSchema = z
  .object({
    kind: relationshipIntentSchema,
    customLabel: z.string().trim().min(1).max(60).optional(),
    isPrimary: z.boolean().default(false),
  })
  .refine((intent) => (intent.kind === 'other') === (intent.customLabel !== undefined), {
    message: 'A custom label is required for "other" and not allowed otherwise',
    path: ['customLabel'],
  });

export const relationshipIntentsUpdateSchema = z.object({
  intents: z
    .array(relationshipIntentInputSchema)
    .min(1, 'Choose at least one')
    .max(5)
    .refine((list) => new Set(list.map((i) => i.kind)).size === list.length, 'Duplicate intention')
    .refine((list) => list.filter((i) => i.isPrimary).length <= 1, 'Only one primary intention'),
});
export type RelationshipIntentsUpdate = z.input<typeof relationshipIntentsUpdateSchema>;

export const discoveryPreferencesSchema = z
  .object({
    minAge: z.number().int().min(18).max(120),
    maxAge: z.number().int().min(18).max(120),
    maxDistanceKm: z.union([z.number().int().min(1).max(20_000), z.null()]),
    /** Identities the person wants to see; empty means everyone. */
    showGenders: categoryListSchema,
    /** Also show people who self-describe without choosing searches, prefer not to say, or haven't answered. */
    includeUnlistedGenders: z.boolean().default(true),
    showAstrology: z.boolean(),
    /** Must-haves, preferences and open-to-exploring. Private. */
    criteria: criteriaListSchema.default([]),
  })
  .refine((prefs) => prefs.maxAge >= prefs.minAge, {
    message: 'Maximum age must not be below minimum age',
    path: ['maxAge'],
  });
export type DiscoveryPreferences = z.infer<typeof discoveryPreferencesSchema>;
export type DiscoveryPreferencesInput = z.input<typeof discoveryPreferencesSchema>;

export const interestSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  label: z.string(),
  category: z.string(),
});
export type Interest = z.infer<typeof interestSchema>;
export const interestListSchema = z.object({ interests: z.array(interestSchema) });

export const interestsUpdateSchema = z.object({
  interestIds: z
    .array(z.uuid())
    .max(MAX_INTERESTS)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate interest'),
});
export type InterestsUpdate = z.infer<typeof interestsUpdateSchema>;

export const PHOTO_MODERATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'REVIEW_REQUIRED',
] as const;
export const photoModerationStatusSchema = z.enum(PHOTO_MODERATION_STATUSES);
export type PhotoModerationStatus = z.infer<typeof photoModerationStatusSchema>;

/** Accepted upload types. The bytes must match the declared type. */
export const ACCEPTED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** One of the owner's own photos, including where it is in moderation. */
export const photoSchema = z.object({
  id: z.uuid(),
  position: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Short-lived signed URL, valid only for the owner. Do not persist. */
  url: z.string().min(1),
  /** Small version for grids and avatars; null for photos stored before thumbnails existed. */
  thumbUrl: z.string().nullable(),
  status: photoModerationStatusSchema,
  /** Reason code for a rejection or review, e.g. "explicit_content". */
  reason: z.string().nullable(),
  /** True when the owner may still ask a person to review a rejection. */
  canAppeal: z.boolean(),
});
export type Photo = z.infer<typeof photoSchema>;

export const photoOrderSchema = z.object({
  photoIds: z
    .array(z.uuid())
    .min(1)
    .max(MAX_PHOTOS)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate photo'),
});
export type PhotoOrder = z.infer<typeof photoOrderSchema>;

export const accountStatusSchema = z.enum(['ONBOARDING', 'ACTIVE', 'PAUSED', 'SUSPENDED']);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const meSchema = z.object({
  id: z.uuid(),
  status: accountStatusSchema,
  /** Contact details are masked; the full value is never returned. */
  emailMasked: z.string().nullable(),
  phoneMasked: z.string().nullable(),
  age: z.number().int(),
  profile: z
    .object({
      displayName: z.string(),
      bio: z.string().nullable(),
      genderIdentity: genderIdentitySchema.nullable(),
      genderSelfDescription: z.string().nullable(),
      genderVisible: z.boolean(),
      discoverableAs: categoryListSchema,
      pronouns: z.string().nullable(),
      occupation: z.string().nullable(),
      city: z.string().nullable(),
      countryCode: z.string().nullable(),
      isDiscoverable: z.boolean(),
      notifyMessages: z.boolean(),
      notifyRequests: z.boolean(),
    })
    .nullable(),
  photos: z.array(photoSchema),
  relationshipIntents: z.array(
    z.object({
      kind: relationshipIntentSchema,
      customLabel: z.string().nullable(),
      isPrimary: z.boolean(),
    }),
  ),
  discoveryPreferences: discoveryPreferencesSchema.nullable(),
  /** null when no location is set. Coordinates are never included. */
  location: locationViewSchema.nullable(),
  interests: z.array(interestSchema),
  /** What still has to be provided before onboarding can be completed. */
  onboardingMissing: z.array(z.enum(['profile', 'photo', 'relationshipIntent'])),
});
export type Me = z.infer<typeof meSchema>;

export const deleteAccountSchema = z.object({ confirm: z.literal('DELETE') });
