import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_IDS,
  buildQuestionnairePrompt,
  QUESTIONNAIRE_ATTRIBUTES,
  QUESTIONNAIRE_VERSION,
} from './assistant-questionnaire.js';
import {
  attributeValueSchema,
  PERSONA_ATTRIBUTE_KEYS,
  PERSONA_ATTRIBUTES,
  personaEditSchema,
  personaRecordsSchema,
} from './persona.js';

const SENSITIVE =
  /relig|caste|ethnic|race|health|medical|sexual|politic|income|salary|money|financ|disab/i;

describe('persona catalogue', () => {
  it('has no attribute for a sensitive trait', () => {
    for (const key of PERSONA_ATTRIBUTE_KEYS) {
      expect(key).not.toMatch(SENSITIVE);
      expect(PERSONA_ATTRIBUTES[key].label).not.toMatch(SENSITIVE);
    }
  });

  it('validates values per attribute type', () => {
    expect(attributeValueSchema('socialEnergy').safeParse(0.75).success).toBe(true);
    expect(attributeValueSchema('socialEnergy').safeParse(1.5).success).toBe(false);
    expect(attributeValueSchema('communicationStyle').safeParse('playful').success).toBe(true);
    expect(attributeValueSchema('communicationStyle').safeParse('rude').success).toBe(false);
    expect(attributeValueSchema('values').safeParse(['honesty', 'calm']).success).toBe(true);
    expect(attributeValueSchema('values').safeParse(['honesty', 'honesty']).success).toBe(false);
    expect(attributeValueSchema('values').safeParse(['religion']).success).toBe(false);
    expect(attributeValueSchema('values').safeParse(Array(6).fill('x')).success).toBe(false);
    expect(attributeValueSchema('boundaries').safeParse(['No smoking indoors']).success).toBe(true);
    expect(attributeValueSchema('boundaries').safeParse(['x'.repeat(81)]).success).toBe(false);
  });

  it('records reject unknown attribute keys', () => {
    const record = {
      value: 0.5,
      confidence: 0.5,
      evidenceCategory: 'INFERRED',
      sourceType: 'PROFILE',
      updatedAt: new Date().toISOString(),
      confirmation: 'unreviewed',
      needsReview: false,
    };
    expect(personaRecordsSchema.safeParse({ socialEnergy: record }).success).toBe(true);
    expect(personaRecordsSchema.safeParse({ religion: record }).success).toBe(false);
  });

  it('an edit must change something', () => {
    expect(personaEditSchema.safeParse({}).success).toBe(false);
    expect(personaEditSchema.safeParse({ clear: ['socialEnergy'] }).success).toBe(true);
    expect(personaEditSchema.safeParse({ clear: ['religion'] }).success).toBe(false);
  });
});

describe('assistant questionnaire', () => {
  it('never asks about boundaries', () => {
    expect(QUESTIONNAIRE_ATTRIBUTES).not.toContain('boundaries');
  });

  it.each(ASSISTANT_IDS)('the %s prompt names every question and the reply format', (id) => {
    const prompt = buildQuestionnairePrompt(id);
    for (const key of QUESTIONNAIRE_ATTRIBUTES) expect(prompt).toContain(`${key} —`);
    expect(prompt).toContain(`"vyra_questionnaire": "${QUESTIONNAIRE_VERSION}"`);
    expect(prompt).toMatch(/health, religion, caste, ethnicity, sexuality, politics or money/);
  });

  it('asks assistants with memory to use it, and others to say unknown', () => {
    expect(buildQuestionnairePrompt('chatgpt')).toMatch(/past conversations/);
    expect(buildQuestionnairePrompt('deepseek')).toMatch(/If you know nothing about me/);
  });
});

describe('gender identity', () => {
  it('accepts every supported identity and rejects anything else', async () => {
    const { genderIdentitySchema, GENDER_IDENTITIES, categoryListSchema } =
      await import('./compatibility.js');
    for (const identity of GENDER_IDENTITIES)
      expect(genderIdentitySchema.safeParse(identity).success).toBe(true);
    expect(genderIdentitySchema.safeParse('female').success).toBe(false);
    // Only concrete identities can be searched for.
    expect(categoryListSchema.safeParse(['WOMAN', 'NON_BINARY']).success).toBe(true);
    expect(categoryListSchema.safeParse(['PREFER_NOT_TO_SAY']).success).toBe(false);
    expect(categoryListSchema.safeParse(['MAN', 'MAN']).success).toBe(false);
  });

  it('the persona catalogue cannot hold a gender', () => {
    for (const key of PERSONA_ATTRIBUTE_KEYS) expect(key.toLowerCase()).not.toContain('gender');
  });
});

describe('relationship criteria', () => {
  it('validates options per criterion and mode', async () => {
    const { criterionSchema, criteriaListSchema } = await import('./compatibility.js');
    expect(
      criterionSchema.safeParse({
        criterion: 'lifestylePace',
        mode: 'must',
        accepted: ['homebody', 'balanced'],
      }).success,
    ).toBe(true);
    expect(
      criterionSchema.safeParse({ criterion: 'lifestylePace', mode: 'must', accepted: ['party'] })
        .success,
    ).toBe(false);
    expect(
      criterionSchema.safeParse({ criterion: 'lifestylePace', mode: 'prefer', accepted: [] })
        .success,
    ).toBe(false);
    expect(
      criterionSchema.safeParse({
        criterion: 'lifestylePace',
        mode: 'must',
        accepted: ['homebody', 'balanced', 'outgoing'],
      }).success,
    ).toBe(false);
    expect(
      criterionSchema.parse({ criterion: 'values', mode: 'open', accepted: ['honesty'] }).accepted,
    ).toEqual([]);
    expect(
      criterionSchema.safeParse({ criterion: 'religion', mode: 'must', accepted: ['x'] }).success,
    ).toBe(false);
    expect(
      criteriaListSchema.safeParse([
        { criterion: 'values', mode: 'open' },
        { criterion: 'values', mode: 'open' },
      ]).success,
    ).toBe(false);
  });

  it('buckets counts', async () => {
    const { countBucket } = await import('./compatibility.js');
    expect([0, 1, 5, 6, 20, 21].map(countBucket)).toEqual([
      '0',
      '1–5',
      '1–5',
      '6–20',
      '6–20',
      '20+',
    ]);
  });
});
