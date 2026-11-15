// Seeded random people for engine parity tests. Covers every attribute kind,
// unknown values, low confidence, every gender option, criteria in all modes,
// missing and present locations, and distance limits.
import { CRITERION_OPTIONS, PERSONA_ATTRIBUTES } from '../packages/validation/dist/index.js';

/** Small, fast, deterministic PRNG (mulberry32). */
export function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, list) => list[Math.floor(r() * list.length)];
const some = (r, list, max) => {
  const shuffled = list.toSorted(() => r() - 0.5);
  return shuffled.slice(0, 1 + Math.floor(r() * Math.min(max, list.length)));
};

const INTERESTS = [
  ['trekking', 'Trekking'],
  ['poetry', 'Poetry'],
  ['specialty-coffee', 'Specialty coffee'],
  ['quizzing', 'Quizzing'],
  ['indie-music', 'Indie music'],
  ['street-food', 'Street food'],
  ['cycling', 'Cycling'],
  ['board-games', 'Board games'],
].map(([slug, label]) => ({ slug, label }));

const GENDERS = [null, 'WOMAN', 'MAN', 'NON_BINARY', 'SELF_DESCRIBE', 'PREFER_NOT_TO_SAY'];
const CATEGORIES = ['WOMAN', 'MAN', 'NON_BINARY'];
const INTENTS = ['serious', 'casual', 'exploring', 'companionship', 'other'];
const CONFIDENCES = [0.3, 0.55, 0.6, 0.7, 0.85, 0.95, 1];

function traitValue(r, definition) {
  if (definition.kind === 'scale') return r() < 0.7 ? pick(r, [0, 0.25, 0.5, 0.75, 1]) : r();
  if (definition.kind === 'enum') return pick(r, definition.options).value;
  const vocabulary = definition.vocabulary ?? [];
  return some(r, vocabulary, Math.min(definition.max, 4)).map((o) => o.value);
}

export function randomPerson(r, id) {
  const traits = {};
  for (const [key, definition] of Object.entries(PERSONA_ATTRIBUTES)) {
    if (definition.kind === 'list' && !definition.vocabulary) continue;
    if (r() < 0.75)
      traits[key] = { value: traitValue(r, definition), confidence: pick(r, CONFIDENCES) };
  }
  const gender = pick(r, GENDERS);
  const minAge = 18 + Math.floor(r() * 15);
  const criteria = [];
  for (const [criterion, { options }] of Object.entries(CRITERION_OPTIONS)) {
    if (r() < 0.3) {
      criteria.push({
        criterion,
        mode: pick(r, ['must', 'prefer', 'prefer', 'open']),
        accepted: some(r, options, 3).map((o) => o.value),
      });
    }
  }
  return {
    id,
    age: 20 + Math.floor(r() * 25),
    gender,
    discoverableAs: gender === 'SELF_DESCRIBE' && r() < 0.6 ? some(r, CATEGORIES, 2) : [],
    intents: r() < 0.08 ? [] : some(r, INTENTS, 2),
    preferences: {
      minAge,
      maxAge: minAge + 5 + Math.floor(r() * 40),
      maxDistanceKm: r() < 0.5 ? null : pick(r, [2, 10, 25, 100, 500]),
      showGenders: r() < 0.5 ? [] : some(r, CATEGORIES, 2),
      includeUnlistedGenders: r() < 0.8,
      criteria,
    },
    location:
      r() < 0.3
        ? null
        : { latitude: 12.6 + r() * 1.2, longitude: 77.2 + r() * 1.2 + (r() < 0.1 ? 3 : 0) },
    traits,
    interests: r() < 0.2 ? [] : some(r, INTERESTS, 6),
  };
}

export const WEIGHT_SETS = [
  {
    version: 'w-default',
    weights: {
      emotional: 0.25,
      communication: 0.2,
      lifestyle: 0.2,
      relationshipAlignment: 0.15,
      intellectual: 0.1,
      mutualPreferences: 0.1,
    },
  },
  {
    version: 'w-skewed',
    weights: {
      emotional: 0.05,
      communication: 0.4,
      lifestyle: 0.1,
      relationshipAlignment: 0.3,
      intellectual: 0.05,
      mutualPreferences: 0.1,
    },
  },
];
