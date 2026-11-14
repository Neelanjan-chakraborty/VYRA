import { z } from 'zod';
import { COMPATIBILITY_DIMENSIONS, COMPATIBILITY_SCENARIOS } from './domain.js';

/**
 * How someone describes their gender. Asked once, never inferred from names,
 * photos, personas or conversations.
 */
export const GENDER_IDENTITIES = [
  'WOMAN',
  'MAN',
  'NON_BINARY',
  'SELF_DESCRIBE',
  'PREFER_NOT_TO_SAY',
] as const;
export const genderIdentitySchema = z.enum(GENDER_IDENTITIES);
export type GenderIdentity = z.infer<typeof genderIdentitySchema>;

/** The identities someone can ask to see. Self-described and undisclosed are handled by `includeUnlistedGenders`. */
export const GENDER_CATEGORIES = ['WOMAN', 'MAN', 'NON_BINARY'] as const;
export const genderCategorySchema = z.enum(GENDER_CATEGORIES);
export type GenderCategory = z.infer<typeof genderCategorySchema>;

export const GENDER_LABELS: Readonly<Record<GenderIdentity, string>> = {
  WOMAN: 'Woman',
  MAN: 'Man',
  NON_BINARY: 'Non-binary',
  SELF_DESCRIBE: 'Self-describe',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};
export const SHOW_GENDER_LABELS: Readonly<Record<GenderCategory, string>> = {
  WOMAN: 'Women',
  MAN: 'Men',
  NON_BINARY: 'Non-binary people',
};

export const categoryListSchema = z
  .array(genderCategorySchema)
  .max(GENDER_CATEGORIES.length)
  .refine((list) => new Set(list).size === list.length, 'Duplicate choice');

/**
 * A hard rule: never suggest someone whose attribute has one of these values.
 * Applied only when the other person's value is known with enough confidence.
 */
export const dealBreakerSchema = z.object({
  kind: z.literal('attribute'),
  attribute: z.enum(['lifestylePace', 'weekendRhythm', 'communicationStyle']),
  exclude: z.array(z.string().min(1).max(40)).min(1).max(4),
});
export type DealBreaker = z.infer<typeof dealBreakerSchema>;
export const dealBreakerListSchema = z.array(dealBreakerSchema).max(5);

export const sufficiencySchema = z.enum(['INSUFFICIENT', 'PARTIAL', 'SUFFICIENT']);
export type Sufficiency = z.infer<typeof sufficiencySchema>;

export const featureResultSchema = z.object({
  feature: z.string(),
  similarity: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});
export type FeatureResult = z.infer<typeof featureResultSchema>;

export const dimensionResultSchema = z.object({
  /** null when no feature of this dimension is known for both people. */
  score: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1),
  coverage: z.number().min(0).max(1),
  features: z.array(featureResultSchema),
  aligned: z.array(z.string()),
  different: z.array(z.string()),
});
export type DimensionResult = z.infer<typeof dimensionResultSchema>;

export const scenarioResultSchema = z.object({
  key: z.enum(COMPATIBILITY_SCENARIOS),
  /** null when too little is known to estimate this scenario. */
  alignment: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1),
  features: z.array(featureResultSchema),
});
export type ScenarioResult = z.infer<typeof scenarioResultSchema>;

export const compatibilityResultSchema = z.object({
  engineVersion: z.string(),
  weightsVersion: z.string(),
  /** Estimated alignment, 0–1. null when data is insufficient. */
  overall: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1),
  sufficiency: sufficiencySchema,
  dimensions: z.record(z.enum(COMPATIBILITY_DIMENSIONS), dimensionResultSchema),
  scenarios: z.array(scenarioResultSchema),
  sharedInterests: z.array(z.string()),
});
export type CompatibilityResult = z.infer<typeof compatibilityResultSchema>;

/** Plain-language names. Scenario outputs are estimated alignment, not predictions. */
export const SCENARIO_TITLES: Readonly<Record<(typeof COMPATIBILITY_SCENARIOS)[number], string>> = {
  firstDate: 'A first date',
  weekendTogether: 'A weekend together',
  longDistance: 'Time apart',
  conflictCommunication: 'Working through a disagreement',
  socialLifestyle: 'Social life',
  financialAttitudes: 'Priorities and planning',
  futurePlanning: 'Planning a future',
  spontaneousTravel: 'A last-minute trip',
  personalBoundaries: 'Respecting each other’s space',
  dailyRoutines: 'Everyday routines',
};

export const compatibilityViewSchema = z.object({
  userId: z.uuid(),
  result: compatibilityResultSchema,
});
export type CompatibilityView = z.infer<typeof compatibilityViewSchema>;

export const recommendationSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  age: z.number().int(),
  city: z.string().nullable(),
  /** Signed URL of the first approved photo, if any. */
  photoUrl: z.string().nullable(),
  overall: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1),
  sufficiency: sufficiencySchema,
  /** Two or three plain-language reasons. */
  highlights: z.array(z.string()),
  sharedInterests: z.array(z.string()),
});
export type Recommendation = z.infer<typeof recommendationSchema>;
export const recommendationListSchema = z.object({
  recommendations: z.array(recommendationSchema),
  engineVersion: z.string(),
  weightsVersion: z.string(),
});
export type RecommendationList = z.infer<typeof recommendationListSchema>;

/** What another person may see of someone's profile. Only approved photos ever appear. */
export const publicPhotoSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export const publicProfileSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  age: z.number().int(),
  city: z.string().nullable(),
  bio: z.string().nullable(),
  occupation: z.string().nullable(),
  /** Only present when the person chose to show it. Never a guess. */
  gender: z.string().nullable(),
  photos: z.array(publicPhotoSchema),
  interests: z.array(z.string()),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;
