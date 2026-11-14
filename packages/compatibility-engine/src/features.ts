import {
  PERSONA_ATTRIBUTES,
  type PersonaAttributeKey,
  type RelationshipIntent,
} from '@vyra/validation';
import { distanceKm } from './geo.js';
import type { Person } from './types.js';

/** Confidence given to facts the people stated themselves (intentions, interests, preferences). */
export const STATED_CONFIDENCE = 0.95;

export type FeatureKey =
  | 'emotionalExpressiveness'
  | 'affectionExpression'
  | 'conflictApproach'
  | 'communicationStyle'
  | 'socialEnergy'
  | 'lifestylePace'
  | 'weekendRhythm'
  | 'planningStyle'
  | 'intellectualCuriosity'
  | 'adventureOrientation'
  | 'values'
  | 'intents'
  | 'sharedInterests'
  | 'preferenceFit';

export interface Comparison {
  readonly similarity: number;
  readonly confidence: number;
  readonly aligned: string | null;
  readonly different: string | null;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const pairKey = (a: string, b: string) => [a, b].toSorted().join('|');

/** Fit between two different values; identical values fit 1. Symmetric. */
const COMMUNICATION_FIT: Readonly<Record<string, number>> = {
  [pairKey('concise', 'expansive')]: 0.4,
  [pairKey('playful', 'reflective')]: 0.5,
  [pairKey('concise', 'playful')]: 0.6,
  [pairKey('concise', 'reflective')]: 0.7,
  [pairKey('expansive', 'playful')]: 0.7,
  [pairKey('expansive', 'reflective')]: 0.8,
};
const WEEKEND_FIT: Readonly<Record<string, number>> = {
  [pairKey('restful', 'social')]: 0.4,
  [pairKey('restful', 'adventurous')]: 0.3,
  [pairKey('restful', 'productive')]: 0.6,
  [pairKey('social', 'adventurous')]: 0.7,
  [pairKey('social', 'productive')]: 0.4,
  [pairKey('adventurous', 'productive')]: 0.5,
};
const PACE_ORDER = ['homebody', 'balanced', 'outgoing'];

/**
 * How well two relationship intentions fit. 0 for a hard mismatch (serious
 * and casual), which the eligibility gate treats as a deal-breaker.
 */
const INTENT_FIT: Readonly<Record<string, number>> = {
  [pairKey('serious', 'casual')]: 0,
  [pairKey('serious', 'companionship')]: 0.7,
  [pairKey('casual', 'companionship')]: 0.5,
  [pairKey('exploring', 'serious')]: 0.6,
  [pairKey('exploring', 'casual')]: 0.8,
  [pairKey('exploring', 'companionship')]: 0.7,
};

function singleIntentFit(a: RelationshipIntent, b: RelationshipIntent): number {
  if (a === 'other' || b === 'other') return a === b ? 0.6 : 0.5; // free text we cannot compare
  if (a === b) return 1;
  return INTENT_FIT[pairKey(a, b)] ?? 0.5;
}

/** Best fit across both people's intentions, or null if either has none. */
export function intentFit(
  a: readonly RelationshipIntent[],
  b: readonly RelationshipIntent[],
): number | null {
  if (a.length === 0 || b.length === 0) return null;
  return Math.max(...a.flatMap((x) => b.map((y) => singleIntentFit(x, y))));
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function compareTrait(key: PersonaAttributeKey, a: Person, b: Person): Comparison | null {
  const ta = a.traits[key];
  const tb = b.traits[key];
  if (!ta || !tb) return null; // unknown on either side contributes nothing
  const confidence = Math.min(ta.confidence, tb.confidence);
  const definition = PERSONA_ATTRIBUTES[key];

  if (definition.kind === 'scale' && typeof ta.value === 'number' && typeof tb.value === 'number') {
    const similarity = 1 - Math.abs(ta.value - tb.value);
    const mean = (ta.value + tb.value) / 2;
    const side = mean < 0.4 ? lower(definition.low) : mean > 0.6 ? lower(definition.high) : null;
    return {
      similarity,
      confidence,
      aligned:
        similarity >= 0.75
          ? side
            ? `You both lean towards “${side}”`
            : `You’re similar on ${lower(definition.label)}`
          : null,
      different:
        similarity <= 0.5
          ? `${definition.label}: one of you leans towards “${lower(definition.low)}”, the other “${lower(definition.high)}”`
          : null,
    };
  }

  if (definition.kind === 'enum' && typeof ta.value === 'string' && typeof tb.value === 'string') {
    let similarity = 1;
    if (ta.value !== tb.value) {
      if (key === 'communicationStyle')
        similarity = COMMUNICATION_FIT[pairKey(ta.value, tb.value)] ?? 0.5;
      else if (key === 'weekendRhythm')
        similarity = WEEKEND_FIT[pairKey(ta.value, tb.value)] ?? 0.5;
      else
        similarity = 1 - Math.abs(PACE_ORDER.indexOf(ta.value) - PACE_ORDER.indexOf(tb.value)) / 2;
    }
    const label = (v: string) => lower(definition.options.find((o) => o.value === v)?.label ?? v);
    return {
      similarity,
      confidence,
      aligned:
        ta.value === tb.value
          ? `${definition.label}: you’re both “${label(ta.value)}”`
          : similarity >= 0.75
            ? `${definition.label}: “${label(ta.value)}” and “${label(tb.value)}” tend to fit`
            : null,
      different:
        similarity <= 0.5
          ? `${definition.label}: “${label(ta.value)}” and “${label(tb.value)}”`
          : null,
    };
  }

  if (
    definition.kind === 'list' &&
    Array.isArray(ta.value) &&
    Array.isArray(tb.value) &&
    definition.vocabulary
  ) {
    const shared = ta.value.filter((v) => (tb.value as string[]).includes(v));
    const similarity = shared.length / Math.min(ta.value.length, tb.value.length);
    const labels = shared.map((v) =>
      lower(definition.vocabulary?.find((o) => o.value === v)?.label ?? v),
    );
    return {
      similarity,
      confidence,
      aligned: shared.length > 0 ? `You both value ${labels.join(' and ')}` : null,
      different: shared.length === 0 ? 'You put different things first' : null,
    };
  }
  return null;
}

function compareInterests(a: Person, b: Person): Comparison | null {
  // Too few interests says little either way.
  if (a.interests.length < 3 || b.interests.length < 3) return null;
  const theirs = new Set(b.interests.map((i) => i.slug));
  const shared = a.interests.filter((i) => theirs.has(i.slug));
  const similarity = Math.min(1, shared.length / 3);
  return {
    similarity,
    confidence: STATED_CONFIDENCE,
    aligned:
      shared.length > 0
        ? `You share ${shared
            .slice(0, 3)
            .map((i) => lower(i.label))
            .join(', ')}`
        : null,
    different: null,
  };
}

function ageFit(age: number, min: number, max: number): number {
  const mid = (min + max) / 2;
  const half = Math.max(1, (max - min) / 2);
  return Math.max(0, 1 - (0.4 * Math.abs(age - mid)) / half);
}

/** How comfortably each person sits inside the other's stated limits. */
function comparePreferences(a: Person, b: Person): Comparison {
  const fits = [
    ageFit(b.age, a.preferences.minAge, a.preferences.maxAge),
    ageFit(a.age, b.preferences.minAge, b.preferences.maxAge),
  ];
  if (a.location && b.location) {
    const d = distanceKm(a.location, b.location);
    for (const limit of [a.preferences.maxDistanceKm, b.preferences.maxDistanceKm]) {
      if (limit !== null) fits.push(Math.max(0, 1 - (0.4 * d) / limit));
    }
  }
  const similarity = fits.reduce((s, f) => s + f, 0) / fits.length;
  return {
    similarity,
    confidence: STATED_CONFIDENCE,
    aligned: similarity >= 0.8 ? 'You sit comfortably within each other’s preferences' : null,
    different: null,
  };
}

function compareIntents(a: Person, b: Person): Comparison | null {
  const similarity = intentFit(a.intents, b.intents);
  if (similarity === null) return null;
  return {
    similarity,
    confidence: STATED_CONFIDENCE,
    aligned:
      similarity === 1
        ? 'You’re looking for the same kind of relationship'
        : similarity >= 0.6
          ? 'What you’re looking for overlaps'
          : null,
    different: similarity < 0.6 ? 'You may want different things from a relationship' : null,
  };
}

/** Every feature for a pair, computed once and shared by dimensions and scenarios. */
export function compareAll(a: Person, b: Person): Map<FeatureKey, Comparison> {
  const result = new Map<FeatureKey, Comparison>();
  const set = (key: FeatureKey, comparison: Comparison | null) => {
    if (comparison)
      result.set(key, {
        ...comparison,
        similarity: round(comparison.similarity),
        confidence: round(comparison.confidence),
      });
  };
  for (const key of [
    'emotionalExpressiveness',
    'affectionExpression',
    'conflictApproach',
    'communicationStyle',
    'socialEnergy',
    'lifestylePace',
    'weekendRhythm',
    'planningStyle',
    'intellectualCuriosity',
    'adventureOrientation',
    'values',
  ] as const) {
    set(key, compareTrait(key, a, b));
  }
  set('intents', compareIntents(a, b));
  set('sharedInterests', compareInterests(a, b));
  set('preferenceFit', comparePreferences(a, b));
  return result;
}

export function sharedInterestLabels(a: Person, b: Person): string[] {
  const theirs = new Set(b.interests.map((i) => i.slug));
  return a.interests.filter((i) => theirs.has(i.slug)).map((i) => i.label);
}
