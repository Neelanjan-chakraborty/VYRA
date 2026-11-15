import { z } from 'zod';

/** Bump when the attribute catalogue or record shape changes incompatibly. */
export const PERSONA_SCHEMA_VERSION = '1';

/** Scale attributes run 0–1 and are edited and asked about in five steps. */
export const SCALE_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

interface ScaleDefinition {
  readonly kind: 'scale';
  readonly label: string;
  /** What 0 means, in plain words. */
  readonly low: string;
  /** What 1 means, in plain words. */
  readonly high: string;
}
interface EnumDefinition {
  readonly kind: 'enum';
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}
interface ListDefinition {
  readonly kind: 'list';
  readonly label: string;
  readonly max: number;
  /** Closed vocabulary; null means free text written by the person. */
  readonly vocabulary: readonly { readonly value: string; readonly label: string }[] | null;
  /** Only the person can set it; AI sources are ignored. */
  readonly userStatedOnly: boolean;
}
type AttributeDefinition = ScaleDefinition | EnumDefinition | ListDefinition;

const scale = (label: string, low: string, high: string): ScaleDefinition => ({
  kind: 'scale',
  label,
  low,
  high,
});
const options = (...pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

/**
 * Everything a persona can describe. Deliberately nothing about health,
 * religion, caste, ethnicity, sexuality, politics or finances: those cannot be
 * represented, so they cannot be inferred, stored or shown.
 */
export const PERSONA_ATTRIBUTES = {
  socialEnergy: scale('Social energy', 'Recharges alone', 'Recharges around people'),
  emotionalExpressiveness: scale(
    'Emotional expression',
    'Keeps feelings private',
    'Shares feelings openly',
  ),
  intellectualCuriosity: scale('Curiosity', 'Prefers the familiar', 'Chases new ideas'),
  adventureOrientation: scale('Adventure', 'Loves routine and comfort', 'Seeks the unfamiliar'),
  planningStyle: scale('Planning', 'Spontaneous', 'Plans ahead'),
  conflictApproach: scale('In disagreements', 'Needs space first', 'Talks it through right away'),
  affectionExpression: scale('Affection', 'Shows care quietly', 'Shows care openly'),
  communicationStyle: {
    kind: 'enum',
    label: 'Communication style',
    options: options(
      ['concise', 'Brief and direct'],
      ['expansive', 'Detailed and expressive'],
      ['playful', 'Playful and teasing'],
      ['reflective', 'Thoughtful and considered'],
    ),
  },
  lifestylePace: {
    kind: 'enum',
    label: 'Pace of life',
    options: options(
      ['homebody', 'Mostly at home'],
      ['balanced', 'A mix of in and out'],
      ['outgoing', 'Mostly out and about'],
    ),
  },
  weekendRhythm: {
    kind: 'enum',
    label: 'A good weekend',
    options: options(
      ['restful', 'Slow and restful'],
      ['social', 'Full of people'],
      ['adventurous', 'Somewhere new'],
      ['productive', 'Getting things done'],
    ),
  },
  values: {
    kind: 'list',
    label: 'What matters most',
    max: 5,
    userStatedOnly: false,
    vocabulary: options(
      ['honesty', 'Honesty'],
      ['kindness', 'Kindness'],
      ['ambition', 'Ambition'],
      ['curiosity', 'Curiosity'],
      ['family', 'Family'],
      ['independence', 'Independence'],
      ['humour', 'Humour'],
      ['loyalty', 'Loyalty'],
      ['creativity', 'Creativity'],
      ['stability', 'Stability'],
      ['adventure', 'Adventure'],
      ['growth', 'Growth'],
      ['community', 'Community'],
      ['calm', 'Calm'],
      ['generosity', 'Generosity'],
    ),
  },
  boundaries: {
    kind: 'list',
    label: 'Boundaries',
    max: 5,
    userStatedOnly: true,
    vocabulary: null,
  },
} as const satisfies Record<string, AttributeDefinition>;

export type PersonaAttributeKey = keyof typeof PERSONA_ATTRIBUTES;
export const PERSONA_ATTRIBUTE_KEYS = Object.keys(PERSONA_ATTRIBUTES) as PersonaAttributeKey[];
export const personaAttributeKeySchema = z.enum(
  PERSONA_ATTRIBUTE_KEYS as [PersonaAttributeKey, ...PersonaAttributeKey[]],
);

export function isPersonaAttributeKey(value: unknown): value is PersonaAttributeKey {
  return typeof value === 'string' && Object.hasOwn(PERSONA_ATTRIBUTES, value);
}

const scaleValueSchema = z.number().min(0).max(1);
const boundaryTextSchema = z.string().trim().min(1).max(80);

function valueSchemaFor(definition: AttributeDefinition): z.ZodType {
  switch (definition.kind) {
    case 'scale':
      return scaleValueSchema;
    case 'enum':
      return z.enum(definition.options.map((o) => o.value) as [string, ...string[]]);
    case 'list': {
      const item = definition.vocabulary
        ? z.enum(definition.vocabulary.map((o) => o.value) as [string, ...string[]])
        : boundaryTextSchema;
      return z
        .array(item)
        .min(1)
        .max(definition.max)
        .refine((items) => new Set(items).size === items.length, 'Duplicate entry');
    }
  }
}

/** Validates the value for one attribute. */
export function attributeValueSchema(key: PersonaAttributeKey): z.ZodType {
  return valueSchemaFor(PERSONA_ATTRIBUTES[key]);
}

export type PersonaAttributeValue = number | string | string[];

export const EVIDENCE_CATEGORIES = ['OBSERVED', 'INFERRED', 'USER_STATED'] as const;
export const evidenceCategorySchema = z.enum(EVIDENCE_CATEGORIES);
export type EvidenceCategory = z.infer<typeof evidenceCategorySchema>;

export const EVIDENCE_SOURCE_TYPES = [
  'PROFILE',
  'PHOTO',
  'CHATGPT_IMPORT',
  'GEMINI_IMPORT',
  'INTEREST_SELECTION',
  'INTEGRATION',
  'USER_CORRECTION',
  'ASSISTANT_REFLECTION',
] as const;
export const evidenceSourceTypeSchema = z.enum(EVIDENCE_SOURCE_TYPES);
export type EvidenceSourceType = z.infer<typeof evidenceSourceTypeSchema>;

export const confirmationSchema = z.enum(['unreviewed', 'confirmed', 'corrected']);
export type Confirmation = z.infer<typeof confirmationSchema>;

/** One attribute as stored in a persona version. Absent attribute = unknown. */
export const personaAttributeRecordSchema = z.object({
  value: z.union([z.number(), z.string(), z.array(z.string())]),
  confidence: z.number().min(0).max(1),
  evidenceCategory: evidenceCategorySchema,
  sourceType: evidenceSourceTypeSchema,
  updatedAt: z.iso.datetime(),
  confirmation: confirmationSchema,
  /** Sources disagreed; the person should look at it. */
  needsReview: z.boolean(),
});
export type PersonaAttributeRecord = z.infer<typeof personaAttributeRecordSchema>;

export const personaRecordsSchema = z.partialRecord(
  personaAttributeKeySchema,
  personaAttributeRecordSchema,
);
export type PersonaRecords = z.infer<typeof personaRecordsSchema>;

/** Why an attribute has its value. A short derived summary, never source text. */
export const personaEvidenceViewSchema = z.object({
  summary: z.string(),
  category: evidenceCategorySchema,
  sourceType: evidenceSourceTypeSchema,
  /** e.g. which assistant answered the questionnaire. */
  sourceDetail: z.string().nullable(),
});
export type PersonaEvidenceView = z.infer<typeof personaEvidenceViewSchema>;

export const personaAttributeViewSchema = personaAttributeRecordSchema.extend({
  evidence: z.array(personaEvidenceViewSchema),
});
export type PersonaAttributeView = z.infer<typeof personaAttributeViewSchema>;

export const personaVersionViewSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(['DRAFT', 'APPROVED']),
  createdAt: z.iso.datetime(),
  approvedAt: z.iso.datetime().nullable(),
  attributes: z.partialRecord(personaAttributeKeySchema, personaAttributeViewSchema),
  unknown: z.array(personaAttributeKeySchema),
});
export type PersonaVersionView = z.infer<typeof personaVersionViewSchema>;

export const generationStatusSchema = z.enum(['idle', 'queued', 'generating', 'ready', 'failed']);
export type GenerationStatus = z.infer<typeof generationStatusSchema>;

export const personaViewSchema = z.object({
  generation: z.object({
    status: generationStatusSchema,
    failureCode: z.string().nullable(),
  }),
  current: personaVersionViewSchema.nullable(),
  draft: personaVersionViewSchema.nullable(),
});
export type PersonaView = z.infer<typeof personaViewSchema>;

/**
 * Edits to the draft. `set` values are validated per attribute on the server
 * with `attributeValueSchema`. Editing with no draft starts one from the
 * approved persona.
 */
export const personaEditSchema = z
  .object({
    set: z.partialRecord(personaAttributeKeySchema, z.unknown()).optional(),
    clear: z.array(personaAttributeKeySchema).max(PERSONA_ATTRIBUTE_KEYS.length).optional(),
    confirm: z.array(personaAttributeKeySchema).max(PERSONA_ATTRIBUTE_KEYS.length).optional(),
  })
  .refine(
    (edit) =>
      Object.keys(edit.set ?? {}).length + (edit.clear?.length ?? 0) + (edit.confirm?.length ?? 0) >
      0,
    'Nothing to change',
  );
export type PersonaEdit = z.infer<typeof personaEditSchema>;

/** Consents a person can grant and withdraw from inside the app. */
export const TOGGLEABLE_CONSENTS = [
  'AI_PERSONA_PROCESSING',
  'AI_IMPORT_PROCESSING',
  'PHOTO_ANALYSIS',
  'ASTROLOGY',
  'WINGMAN_MESSAGE_CONTEXT',
  'WINGMAN',
  'ANALYTICS',
  'MARKETING',
] as const;
export const toggleableConsentSchema = z.enum(TOGGLEABLE_CONSENTS);
export type ToggleableConsent = z.infer<typeof toggleableConsentSchema>;
/** Version of the in-app notice shown when asking for these consents. */
export const CURRENT_AI_NOTICE_VERSION = '2026-11';

export const consentStateSchema = z.object({
  type: toggleableConsentSchema,
  granted: z.boolean(),
  policyVersion: z.string().nullable(),
  grantedAt: z.iso.datetime().nullable(),
});
export const consentListSchema = z.object({ consents: z.array(consentStateSchema) });
export type ConsentState = z.infer<typeof consentStateSchema>;
export const consentUpdateSchema = z.object({ granted: z.boolean() });
