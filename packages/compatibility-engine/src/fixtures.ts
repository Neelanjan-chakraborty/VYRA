import type { PersonaAttributeKey } from '@vyra/validation';
import type { Person, Trait } from './types.js';

/** Builds a synthetic person for tests. Defaults are deliberately open. */
export function person(
  id: string,
  overrides: Partial<Omit<Person, 'preferences'>> & {
    preferences?: Partial<Person['preferences']>;
  } = {},
): Person {
  return {
    id,
    age: 28,
    gender: null,
    intents: ['serious'],
    location: null,
    traits: {},
    interests: [],
    ...overrides,
    preferences: {
      minAge: 18,
      maxAge: 99,
      maxDistanceKm: null,
      interestedIn: [],
      dealBreakers: [],
      ...overrides.preferences,
    },
  };
}

export function traits(
  values: Partial<Record<PersonaAttributeKey, Trait['value']>>,
  confidence = 0.95,
): Person['traits'] {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v, confidence }]));
}

/** A fully described, sociable, adventurous, direct planner. */
export const RICH = traits({
  socialEnergy: 0.75,
  emotionalExpressiveness: 0.75,
  intellectualCuriosity: 0.75,
  adventureOrientation: 1,
  planningStyle: 0.75,
  conflictApproach: 0.75,
  affectionExpression: 0.75,
  communicationStyle: 'expansive',
  lifestylePace: 'outgoing',
  weekendRhythm: 'adventurous',
  values: ['honesty', 'adventure', 'growth'],
});

/** The mirror image of RICH. */
export const OPPOSITE = traits({
  socialEnergy: 0,
  emotionalExpressiveness: 0,
  intellectualCuriosity: 0,
  adventureOrientation: 0,
  planningStyle: 0,
  conflictApproach: 0,
  affectionExpression: 0,
  communicationStyle: 'concise',
  lifestylePace: 'homebody',
  weekendRhythm: 'restful',
  values: ['stability', 'calm', 'family'],
});

export const INTERESTS = [
  { slug: 'trekking', label: 'Trekking' },
  { slug: 'poetry', label: 'Poetry' },
  { slug: 'specialty-coffee', label: 'Specialty coffee' },
  { slug: 'quizzing', label: 'Quizzing' },
];
