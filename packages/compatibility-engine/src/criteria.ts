import type { Criterion, CriterionKey } from '@vyra/validation';
import { STATED_CONFIDENCE } from './features.js';
import type { Person } from './types.js';

/** An inferred trait must be at least this confident before a must-have can exclude on it. */
export const MUST_HAVE_MIN_CONFIDENCE = 0.6;

interface KnownValue {
  readonly values: readonly string[];
  readonly confidence: number;
}

/** What is known about `person` for a criterion, or null when it is unknown. */
export function knownValue(person: Person, criterion: CriterionKey): KnownValue | null {
  if (criterion === 'relationshipIntent') {
    return person.intents.length > 0
      ? { values: person.intents, confidence: STATED_CONFIDENCE }
      : null;
  }
  const trait = person.traits[criterion];
  if (!trait) return null;
  const values = Array.isArray(trait.value)
    ? trait.value
    : typeof trait.value === 'string'
      ? [trait.value]
      : [];
  return values.length > 0 ? { values, confidence: trait.confidence } : null;
}

/** Any overlap counts: e.g. someone looking for several things matches if one is accepted. */
function satisfies(known: KnownValue, criterion: Criterion): boolean {
  return known.values.some((v) => criterion.accepted.includes(v));
}

/**
 * Hard filter. A must-have excludes only on a value that is known — stated,
 * or inferred with confidence ≥ MUST_HAVE_MIN_CONFIDENCE — and not accepted.
 * Missing information is never a mismatch.
 */
export function failsMustHaves(
  viewer: Person,
  other: Person,
  criteria: readonly Criterion[] = viewer.preferences.criteria,
): Criterion | null {
  for (const criterion of criteria) {
    if (criterion.mode !== 'must') continue;
    const known = knownValue(other, criterion.criterion);
    if (known && known.confidence >= MUST_HAVE_MIN_CONFIDENCE && !satisfies(known, criterion))
      return criterion;
  }
  return null;
}

/**
 * Soft signal: for each "prefer" criterion with a known value, 1 if accepted,
 * else 0, weighted by how sure we are of the value. null when nothing applies.
 */
export function preferenceFit(
  viewer: Person,
  other: Person,
): { similarity: number; confidence: number } | null {
  let weighted = 0;
  let weights = 0;
  for (const criterion of viewer.preferences.criteria) {
    if (criterion.mode !== 'prefer') continue;
    const known = knownValue(other, criterion.criterion);
    if (!known) continue;
    weighted += known.confidence * (satisfies(known, criterion) ? 1 : 0);
    weights += known.confidence;
  }
  return weights === 0
    ? null
    : {
        similarity: weighted / weights,
        confidence: weights / viewer.preferences.criteria.filter((c) => c.mode === 'prefer').length,
      };
}
