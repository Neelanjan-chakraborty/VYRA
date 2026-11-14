import { z } from 'zod';

/**
 * Relationship intentions a user may hold. Users can hold several at once and may
 * describe their own with `other` plus a custom label; nobody is forced into one category.
 */
export const RELATIONSHIP_INTENTS = [
  'serious',
  'casual',
  'exploring',
  'companionship',
  'other',
] as const;
export const relationshipIntentSchema = z.enum(RELATIONSHIP_INTENTS);
export type RelationshipIntent = z.infer<typeof relationshipIntentSchema>;

/** The six scored dimensions of the compatibility engine. */
export const COMPATIBILITY_DIMENSIONS = [
  'emotional',
  'communication',
  'lifestyle',
  'relationshipAlignment',
  'intellectual',
  'mutualPreferences',
] as const;
export const compatibilityDimensionSchema = z.enum(COMPATIBILITY_DIMENSIONS);
export type CompatibilityDimension = z.infer<typeof compatibilityDimensionSchema>;

/** Scenario-specific estimated-alignment calculations. */
export const COMPATIBILITY_SCENARIOS = [
  'firstDate',
  'weekendTogether',
  'longDistance',
  'conflictCommunication',
  'socialLifestyle',
  'financialAttitudes',
  'futurePlanning',
  'spontaneousTravel',
  'personalBoundaries',
  'dailyRoutines',
] as const;
export const compatibilityScenarioSchema = z.enum(COMPATIBILITY_SCENARIOS);
export type CompatibilityScenario = z.infer<typeof compatibilityScenarioSchema>;

/** A value in the closed unit interval, used for scores and confidences. */
export const unitIntervalSchema = z.number().min(0).max(1);

/**
 * Dimension weights. They are initial product hypotheses, not validated science,
 * so they are versioned and must sum to 1.
 */
export const compatibilityWeightsSchema = z
  .object({
    emotional: unitIntervalSchema,
    communication: unitIntervalSchema,
    lifestyle: unitIntervalSchema,
    relationshipAlignment: unitIntervalSchema,
    intellectual: unitIntervalSchema,
    mutualPreferences: unitIntervalSchema,
  })
  .refine((weights) => Math.abs(Object.values(weights).reduce((sum, w) => sum + w, 0) - 1) < 1e-9, {
    message: 'Compatibility weights must sum to 1',
  });
export type CompatibilityWeights = z.infer<typeof compatibilityWeightsSchema>;

export const DEFAULT_COMPATIBILITY_WEIGHTS_VERSION = '2026-11-v1';
export const DEFAULT_COMPATIBILITY_WEIGHTS: CompatibilityWeights = {
  emotional: 0.25,
  communication: 0.2,
  lifestyle: 0.15,
  relationshipAlignment: 0.2,
  intellectual: 0.1,
  mutualPreferences: 0.1,
};

/** Minimum age to hold an account. */
export const MINIMUM_AGE_YEARS = 18;
