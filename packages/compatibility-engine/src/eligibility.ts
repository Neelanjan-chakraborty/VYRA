import { distanceKm } from './geo.js';
import { intentFit } from './features.js';
import type { IneligibleReason, Person } from './types.js';

/** A deal-breaker only fires on a value known with at least this confidence. */
export const DEAL_BREAKER_MIN_CONFIDENCE = 0.6;

function acceptsAge(viewer: Person, other: Person): boolean {
  return other.age >= viewer.preferences.minAge && other.age <= viewer.preferences.maxAge;
}

/**
 * Whether `viewer`'s "show me" choice includes `other`:
 * - showing everyone includes everyone;
 * - Woman / Man / Non-binary must be in the chosen list;
 * - Self-describe with chosen searches is included if any chosen search matches;
 * - Self-describe without chosen searches, prefer not to say, or not answered is
 *   included unless the viewer turned off "people who describe their gender
 *   differently or prefer not to say" (on by default).
 * Nothing is ever inferred, so no one is dropped for being hard to categorise.
 */
export function acceptsGender(viewer: Person, other: Person): boolean {
  const wanted = viewer.preferences.showGenders;
  if (wanted.length === 0) return true;
  const identity = other.gender;
  if (identity === 'WOMAN' || identity === 'MAN' || identity === 'NON_BINARY')
    return wanted.includes(identity);
  if (identity === 'SELF_DESCRIBE' && other.discoverableAs.length > 0) {
    return other.discoverableAs.some((category) => wanted.includes(category));
  }
  return viewer.preferences.includeUnlistedGenders;
}

function withinDistance(viewer: Person, other: Person): boolean {
  const limit = viewer.preferences.maxDistanceKm;
  if (limit === null || !viewer.location || !other.location) return true;
  return distanceKm(viewer.location, other.location) <= limit;
}

function breaksDealBreaker(viewer: Person, other: Person): boolean {
  return viewer.preferences.dealBreakers.some((rule) => {
    const trait = other.traits[rule.attribute];
    return (
      trait !== undefined &&
      trait.confidence >= DEAL_BREAKER_MIN_CONFIDENCE &&
      typeof trait.value === 'string' &&
      rule.exclude.includes(trait.value)
    );
  });
}

/**
 * Hard gates, checked in both directions: each person must fit the other's
 * stated limits. Returns the first reason the pair is ineligible, or null.
 */
export function ineligibility(a: Person, b: Person): IneligibleReason | null {
  if (a.id === b.id) return 'self';
  if (!acceptsAge(a, b) || !acceptsAge(b, a)) return 'age_preference';
  if (!acceptsGender(a, b) || !acceptsGender(b, a)) return 'gender_preference';
  if (!withinDistance(a, b) || !withinDistance(b, a)) return 'distance';
  if ((intentFit(a.intents, b.intents) ?? 0) < 0.5) return 'intent_mismatch';
  if (breaksDealBreaker(a, b) || breaksDealBreaker(b, a)) return 'deal_breaker';
  return null;
}
