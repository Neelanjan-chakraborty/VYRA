import {
  attributeValueSchema,
  isPersonaAttributeKey,
  PERSONA_ATTRIBUTES,
  type PersonaAttributeKey,
  type PersonaAttributeValue,
  QUESTIONNAIRE_ATTRIBUTES,
  QUESTIONNAIRE_VERSION,
} from '@vyra/validation';
import { z } from 'zod';

export type ParsedAnswer = {
  value: PersonaAttributeValue;
  confidence: 'low' | 'medium' | 'high';
  why: string;
};

export interface ParsedReflection {
  readonly answers: Map<PersonaAttributeKey, ParsedAnswer>;
  readonly unknown: PersonaAttributeKey[];
  /** Keys present but unusable (bad value, not asked, not in the catalogue). */
  readonly rejected: string[];
}

export type ReflectionParseError = 'no_json' | 'invalid_json' | 'wrong_shape' | 'wrong_version';

const MAX_REJECTED_REPORTED = 20;

/** Finds the JSON object: inside a ```json fence if there is one, else the first balanced {...}. */
export function extractJsonBlock(text: string): string | null {
  const fenced = /```(?:json)?\s*\n([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]?.includes('{')) return fenced[1].trim();
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

const envelopeSchema = z.object({
  vyra_questionnaire: z.union([z.string(), z.number()]).transform(String),
  answers: z.record(z.string(), z.unknown()),
});

const answerSchema = z.object({
  value: z.unknown(),
  confidence: z.enum(['low', 'medium', 'high']).catch('low'),
  why: z.string().max(1000).catch(''),
});

/** Scales are asked as 1–5 so people and models answer naturally; stored as 0–1. */
function normaliseValue(key: PersonaAttributeKey, value: unknown): unknown {
  const definition = PERSONA_ATTRIBUTES[key];
  if (definition.kind === 'scale') {
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 1 || n > 5) return Number.NaN;
    return (Math.round(n) - 1) / 4;
  }
  if (definition.kind === 'enum' && typeof value === 'string') return value.trim().toLowerCase();
  if (definition.kind === 'list' && Array.isArray(value)) {
    return [...new Set(value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)))];
  }
  return value;
}

/**
 * Reads the reply a person pasted back from their own assistant. It is parsed
 * strictly as data — never sent to a model — so instructions inside it have
 * no effect beyond producing (or failing to produce) schema-valid answers.
 */
export function parseAssistantReply(reply: string): ParsedReflection | ReflectionParseError {
  const block = extractJsonBlock(reply);
  if (!block) return 'no_json';
  let json: unknown;
  try {
    json = JSON.parse(block);
  } catch {
    return 'invalid_json';
  }
  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) return 'wrong_shape';
  if (envelope.data.vyra_questionnaire !== QUESTIONNAIRE_VERSION) return 'wrong_version';

  const asked = new Set<string>(QUESTIONNAIRE_ATTRIBUTES);
  const answers = new Map<PersonaAttributeKey, ParsedAnswer>();
  const unknown: PersonaAttributeKey[] = [];
  const rejected: string[] = [];

  for (const [key, raw] of Object.entries(envelope.data.answers)) {
    if (!isPersonaAttributeKey(key) || !asked.has(key)) {
      if (rejected.length < MAX_REJECTED_REPORTED) rejected.push(key.slice(0, 40));
      continue;
    }
    const answer = answerSchema.safeParse(
      typeof raw === 'object' && raw !== null ? raw : { value: raw },
    );
    if (!answer.success) {
      rejected.push(key);
      continue;
    }
    const { value, confidence, why } = answer.data;
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim().toLowerCase() === 'unknown')
    ) {
      unknown.push(key);
      continue;
    }
    const parsed = attributeValueSchema(key).safeParse(normaliseValue(key, value));
    if (!parsed.success) {
      rejected.push(key);
      continue;
    }
    answers.set(key, { value: parsed.data as PersonaAttributeValue, confidence, why });
  }
  return { answers, unknown, rejected };
}
