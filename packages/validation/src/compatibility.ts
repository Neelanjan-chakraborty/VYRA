import { z } from 'zod';
import { COMPATIBILITY_DIMENSIONS, COMPATIBILITY_SCENARIOS } from './domain.js';
import { distanceFilterStatusSchema } from './location.js';
import { PERSONA_ATTRIBUTES } from './persona.js';

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
 * What someone can say about the people they're shown, criterion by criterion:
 * - `must`: a strict filter. Someone whose value is *known* and not accepted
 *   is never shown. Unknown values never count as a mismatch.
 * - `prefer`: a ranking signal only; nobody is excluded.
 * - `open`: no effect.
 * Private to the person who sets them.
 */
export const CRITERIA = [
  'relationshipIntent',
  'lifestylePace',
  'weekendRhythm',
  'communicationStyle',
  'values',
] as const;
export const criterionKeySchema = z.enum(CRITERIA);
export type CriterionKey = z.infer<typeof criterionKeySchema>;
export const criterionModeSchema = z.enum(['must', 'prefer', 'open']);
export type CriterionMode = z.infer<typeof criterionModeSchema>;

const option = (value: string, label: string) => ({ value, label });
/** The options for each criterion. Persona criteria reuse the persona catalogue. */
export const CRITERION_OPTIONS: Readonly<
  Record<CriterionKey, { label: string; options: readonly { value: string; label: string }[] }>
> = {
  relationshipIntent: {
    label: 'What they’re looking for',
    options: [
      option('serious', 'Something serious'),
      option('casual', 'Something casual'),
      option('exploring', 'Still working it out'),
      option('companionship', 'Companionship'),
      option('other', 'Something else'),
    ],
  },
  lifestylePace: {
    label: PERSONA_ATTRIBUTES.lifestylePace.label,
    options: PERSONA_ATTRIBUTES.lifestylePace.options,
  },
  weekendRhythm: {
    label: PERSONA_ATTRIBUTES.weekendRhythm.label,
    options: PERSONA_ATTRIBUTES.weekendRhythm.options,
  },
  communicationStyle: {
    label: PERSONA_ATTRIBUTES.communicationStyle.label,
    options: PERSONA_ATTRIBUTES.communicationStyle.options,
  },
  values: { label: 'Values (at least one shared)', options: PERSONA_ATTRIBUTES.values.vocabulary },
};

export const criterionSchema = z
  .object({
    criterion: criterionKeySchema,
    mode: criterionModeSchema,
    /** Acceptable values. Required for must/prefer; ignored for open. */
    accepted: z.array(z.string().min(1).max(40)).max(15).default([]),
  })
  .superRefine((c, ctx) => {
    const allowed = new Set(CRITERION_OPTIONS[c.criterion].options.map((o) => o.value));
    if (c.accepted.some((v) => !allowed.has(v)))
      ctx.addIssue({ code: 'custom', path: ['accepted'], message: 'Unknown option' });
    if (new Set(c.accepted).size !== c.accepted.length)
      ctx.addIssue({ code: 'custom', path: ['accepted'], message: 'Duplicate option' });
    if (c.mode !== 'open' && c.accepted.length === 0)
      ctx.addIssue({ code: 'custom', path: ['accepted'], message: 'Choose at least one option' });
    if (c.mode === 'must' && c.accepted.length === allowed.size) {
      ctx.addIssue({
        code: 'custom',
        path: ['accepted'],
        message: 'Accepting every option isn’t a must-have — choose “Open” instead',
      });
    }
  })
  .transform((c) => (c.mode === 'open' ? { ...c, accepted: [] } : c));
export type Criterion = z.output<typeof criterionSchema>;

export const criteriaListSchema = z
  .array(criterionSchema)
  .max(CRITERIA.length)
  .refine(
    (list) => new Set(list.map((c) => c.criterion)).size === list.length,
    'Each criterion once',
  );

/** Counts are bucketed so the impact estimate never identifies anyone. */
export const countBucketSchema = z.enum(['0', '1–5', '6–20', '20+']);
export type CountBucket = z.infer<typeof countBucketSchema>;
export function countBucket(n: number): CountBucket {
  if (n <= 0) return '0';
  if (n <= 5) return '1–5';
  if (n <= 20) return '6–20';
  return '20+';
}

export const criteriaImpactSchema = z.object({
  /** People who fit everything except the viewer's must-haves. */
  withoutMustHaves: countBucketSchema,
  withMustHaves: countBucketSchema,
  /** Must-haves remove at least half of a pool of at least ten people. */
  significant: z.boolean(),
  perCriterion: z.array(z.object({ criterion: criterionKeySchema, excludes: countBucketSchema })),
});
export type CriteriaImpact = z.infer<typeof criteriaImpactSchema>;

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
  /** A band like "About 10 km away"; null when either location is unknown. */
  distance: z.string().nullable(),
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
  distanceFilter: distanceFilterStatusSchema,
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
  distance: z.string().nullable(),
  photos: z.array(publicPhotoSchema),
  interests: z.array(z.string()),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;
