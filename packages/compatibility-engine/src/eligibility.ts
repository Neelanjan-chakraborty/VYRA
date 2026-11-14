import { distanceKm } from './geo.js';
import { intentFit } from './features.js';
import type { IneligibleReason, Person } from './types.js';

/** A deal-breaker only fires on a value known with at least this confidence. */
export const DEAL_BREAKER_MIN_CONFIDENCE = 0.6;

function acceptsAge(viewer: Person, other: Person): boolean {
  return other.age >= viewer.preferences.minAge && other.age <= viewer.preferences.maxAge;
}

function acceptsGender(viewer: Person, other: Person): boolean {
  const wanted = viewer.preferences.interestedIn;
  // A preference is only satisfied by a known, matching category: we never guess.
  return wanted.length === 0 || (other.gender !== null && wanted.includes(other.gender));
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
