import { z } from 'zod';
import { COMPATIBILITY_DIMENSIONS, COMPATIBILITY_SCENARIOS } from './domain.js';

/** Gender categories used for matching preferences. Free-text gender maps onto these, or none. */
export const GENDER_CATEGORIES = ['woman', 'man', 'nonbinary'] as const;
export const genderCategorySchema = z.enum(GENDER_CATEGORIES);
export type GenderCategory = z.infer<typeof genderCategorySchema>;

/**
 * Maps a free-text gender, or an "interested in" choice like "Women", to a
 * category. Anything unrecognised returns null rather than a guess.
 */
export function genderCategory(text: string | null | undefined): GenderCategory | null {
  const value = (text ?? '').trim().toLowerCase();
  if (/^(women|woman|female|f|girl|lady)$/.test(value)) return 'woman';
  if (/^(men|man|male|m|guy)$/.test(value)) return 'man';
  if (/^(non-?binary( people| person)?|nb|enby|genderqueer|genderfluid|agender)$/.test(value))
    return 'nonbinary';
  return null;
}

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
