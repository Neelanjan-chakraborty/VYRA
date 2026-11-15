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

export type ReflectionParseError =
  'no_json' | 'cut_off' | 'invalid_json' | 'wrong_shape' | 'wrong_version';

/** A parse failure that says where, so the person can see what to fix. */
export interface ReflectionParseFailure {
  readonly error: ReflectionParseError;
  /** A short, safe excerpt around the problem, from the person's own text. */
  readonly near?: string;
}

const MAX_REJECTED_REPORTED = 20;

/**
 * Finds the JSON object: inside a ```json fence if there is one, else the first
 * balanced {...}. "unclosed" means the object starts but the text ends first.
 */
export function extractJsonBlock(text: string): string | 'unclosed' | null {
  const fenced = /```(?:json)?[ \t]*\r?\n?([\s\S]*?)```/i.exec(text);
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
  return 'unclosed';
}

/** Curly quotes and invisible or non-breaking characters, as chat apps and keyboards insert them. */
export function normaliseTypography(text: string): string {
  return text
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

/**
 * Removes comments and trailing commas, which assistants add and JSON forbids.
 * Walks the text so anything inside a string is left exactly as written.
 */
export function repairJson(text: string): string {
  const source = normaliseTypography(text);
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source.charAt(i);
    const next = source.charAt(i + 1);
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < source.length && source.charAt(i) !== '\n') i += 1;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source.charAt(i) === '*' && source.charAt(i + 1) === '/'))
        i += 1;
      i += 1;
    } else if (ch === ',') {
      let ahead = i + 1;
      while (/\s/.test(source.charAt(ahead))) ahead += 1;
      if (source.charAt(ahead) !== '}' && source.charAt(ahead) !== ']') out += ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** "…text around the problem…" for a JSON.parse error message, or undefined. */
function excerptAround(block: string, error: unknown): string | undefined {
  const position = /position (\d+)/.exec(error instanceof Error ? error.message : '')?.[1];
  if (position === undefined) return undefined;
  const at = Number(position);
  const clip = block
    .slice(Math.max(0, at - 24), at + 24)
    .replace(/\s+/g, ' ')
    .trim();
  return clip ? `…${clip}…` : undefined;
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
/** The JSON in a reply, or why there isn't any. */
function readJson(text: string, repair: boolean): { json: unknown } | ReflectionParseFailure {
  const block = extractJsonBlock(repair ? normaliseTypography(text) : text);
  if (block === null) return { error: 'no_json' };
  if (block === 'unclosed') return { error: 'cut_off' };
  const candidate = repair ? repairJson(block) : block;
  try {
    return { json: JSON.parse(candidate) as unknown };
  } catch (error) {
    const near = excerptAround(candidate, error);
    return near ? { error: 'invalid_json', near } : { error: 'invalid_json' };
  }
}

export function parseAssistantReply(reply: string): ParsedReflection | ReflectionParseFailure {
  // As pasted first: valid JSON may legitimately contain curly quotes. Only if
  // that fails are the usual copy-and-paste damage repaired and tried again.
  let read = readJson(reply, false);
  if (!('json' in read)) read = readJson(reply, true);
  if (!('json' in read)) return read;
  const json = read.json;
  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) return { error: 'wrong_shape' };
  if (envelope.data.vyra_questionnaire !== QUESTIONNAIRE_VERSION) return { error: 'wrong_version' };

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
