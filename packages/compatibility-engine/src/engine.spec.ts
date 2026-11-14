import {
  COMPATIBILITY_DIMENSIONS,
  COMPATIBILITY_SCENARIOS,
  compatibilityResultSchema,
  DEFAULT_COMPATIBILITY_WEIGHTS,
} from '@vyra/validation';
import { describe, expect, it } from 'vitest';
import { ineligibility } from './eligibility.js';
import { INTERESTS, OPPOSITE, person, RICH, traits } from './fixtures.js';
import { rankScore, rankWithDiversity } from './rank.js';
import { highlights, score } from './score.js';

const W = DEFAULT_COMPATIBILITY_WEIGHTS;
const run = (a: ReturnType<typeof person>, b: ReturnType<typeof person>) =>
  score(a, b, W, 'test-weights');

describe('eligibility gates', () => {
  it('never pairs someone with themselves', () => {
    expect(ineligibility(person('a'), person('a'))).toBe('self');
  });

  it('checks age limits in both directions', () => {
    const a = person('a', { age: 30, preferences: { minAge: 25, maxAge: 35 } });
    expect(ineligibility(a, person('b', { age: 40 }))).toBe('age_preference');
    expect(ineligibility(person('b', { age: 40 }), a)).toBe('age_preference');
    // b is within a's range, but a is outside b's.
    expect(
      ineligibility(a, person('b', { age: 28, preferences: { minAge: 18, maxAge: 26 } })),
    ).toBe('age_preference');
    expect(ineligibility(a, person('b', { age: 35 }))).toBeNull();
  });

  it('respects gender preferences and never guesses an unknown gender', () => {
    const wantsWomen = person('a', { gender: 'man', preferences: { interestedIn: ['woman'] } });
    expect(ineligibility(wantsWomen, person('b', { gender: 'woman' }))).toBeNull();
    expect(ineligibility(wantsWomen, person('b', { gender: 'man' }))).toBe('gender_preference');
    expect(ineligibility(wantsWomen, person('b', { gender: null }))).toBe('gender_preference');
    // b only wants women, a is a man: fails in the other direction.
    expect(
      ineligibility(
        wantsWomen,
        person('b', { gender: 'woman', preferences: { interestedIn: ['woman'] } }),
      ),
    ).toBe('gender_preference');
    expect(ineligibility(person('a'), person('b'))).toBeNull();
  });

  it('applies distance only when both locations and a limit are known', () => {
    const bengaluru = { latitude: 12.97, longitude: 77.59 };
    const mumbai = { latitude: 19.08, longitude: 72.88 };
    const near = person('a', { location: bengaluru, preferences: { maxDistanceKm: 50 } });
    expect(ineligibility(near, person('b', { location: mumbai }))).toBe('distance');
    expect(ineligibility(near, person('b', { location: bengaluru }))).toBeNull();
    expect(ineligibility(near, person('b', { location: null }))).toBeNull();
  });

  it('treats serious vs casual as a deal-breaker, but not other overlaps', () => {
    expect(
      ineligibility(person('a', { intents: ['serious'] }), person('b', { intents: ['casual'] })),
    ).toBe('intent_mismatch');
    expect(
      ineligibility(
        person('a', { intents: ['serious', 'exploring'] }),
        person('b', { intents: ['casual'] }),
      ),
    ).toBeNull();
    expect(
      ineligibility(
        person('a', { intents: ['companionship'] }),
        person('b', { intents: ['serious'] }),
      ),
    ).toBeNull();
    expect(ineligibility(person('a', { intents: [] }), person('b'))).toBe('intent_mismatch');
  });

  it('fires a deal-breaker only on a confidently known value', () => {
    const picky = person('a', {
      preferences: {
        dealBreakers: [{ kind: 'attribute', attribute: 'lifestylePace', exclude: ['outgoing'] }],
      },
    });
    expect(
      ineligibility(picky, person('b', { traits: traits({ lifestylePace: 'outgoing' }) })),
    ).toBe('deal_breaker');
    expect(
      ineligibility(person('b', { traits: traits({ lifestylePace: 'outgoing' }) }), picky),
    ).toBe('deal_breaker');
    expect(
      ineligibility(picky, person('b', { traits: traits({ lifestylePace: 'outgoing' }, 0.3) })),
    ).toBeNull();
    expect(ineligibility(picky, person('b'))).toBeNull();
  });
});

const rich = (id: string, overrides = {}) =>
  person(id, { traits: RICH, interests: INTERESTS, ...overrides });

describe('scoring synthetic people', () => {
  it('produces a schema-valid result with every dimension and scenario', () => {
    const result = run(rich('a'), rich('b'));
    expect(compatibilityResultSchema.parse(result)).toEqual(result);
    expect(Object.keys(result.dimensions).toSorted()).toEqual(
      [...COMPATIBILITY_DIMENSIONS].toSorted(),
    );
    expect(result.scenarios.map((s) => s.key)).toEqual([...COMPATIBILITY_SCENARIOS]);
  });

  it('identical, fully described people score high and sufficient', () => {
    const result = run(rich('a'), rich('b'));
    expect(result.sufficiency).toBe('SUFFICIENT');
    expect(result.overall).toBeGreaterThan(0.9);
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.sharedInterests).toEqual(INTERESTS.map((i) => i.label));
  });

  it('opposite people score clearly lower, with the differences explained', () => {
    const same = run(rich('a'), rich('b'));
    const opposite = run(
      rich('a'),
      person('b', {
        traits: OPPOSITE,
        interests: [
          { slug: 'baking', label: 'Baking' },
          { slug: 'yoga', label: 'Yoga' },
          { slug: 'anime', label: 'Anime' },
        ],
      }),
    );
    expect(opposite.sufficiency).toBe('SUFFICIENT');
    expect(opposite.overall).toBeLessThan(0.55);
    expect((same.overall ?? 0) - (opposite.overall ?? 0)).toBeGreaterThan(0.35);
    expect(opposite.dimensions.lifestyle.different.length).toBeGreaterThan(0);
    expect(opposite.dimensions.emotional.score).toBeLessThan(0.35);
  });

  it('two people with no persona get no number at all', () => {
    const result = run(person('a'), person('b'));
    expect(result.sufficiency).toBe('INSUFFICIENT');
    expect(result.overall).toBeNull();
    expect(result.dimensions.emotional).toMatchObject({ score: null, coverage: 0, confidence: 0 });
  });

  it('missing data never inflates a score', () => {
    // Two sparse people who agree on the little that is known.
    const sparseA = person('a', {
      traits: traits({
        socialEnergy: 0.75,
        conflictApproach: 0.75,
        communicationStyle: 'expansive',
        emotionalExpressiveness: 0.75,
      }),
    });
    const sparseB = person('b', {
      traits: traits({
        socialEnergy: 0.75,
        conflictApproach: 0.75,
        communicationStyle: 'expansive',
        emotionalExpressiveness: 0.75,
      }),
    });
    const sparse = run(sparseA, sparseB);
    const full = run(rich('a'), rich('b'));
    expect(sparse.sufficiency).toBe('PARTIAL');
    expect(sparse.overall).not.toBeNull();
    expect(sparse.overall).toBeLessThan(full.overall ?? 0);
    expect(sparse.confidence).toBeLessThan(full.confidence);
  });

  it('a rich profile cannot carry a sparse one', () => {
    const result = run(rich('a'), person('b', { traits: traits({ socialEnergy: 0.75 }) }));
    expect(result.sufficiency).toBe('INSUFFICIENT');
    expect(result.overall).toBeNull();
  });

  it('low-confidence traits count for less', () => {
    const sure = run(rich('a'), person('b', { traits: OPPOSITE, interests: INTERESTS }));
    const unsure = run(
      rich('a'),
      person('b', {
        traits: traits(
          Object.fromEntries(Object.entries(OPPOSITE).map(([k, t]) => [k, t?.value])),
          0.2,
        ),
        interests: INTERESTS,
      }),
    );
    expect(unsure.confidence).toBeLessThan(sure.confidence);
  });

  it('is symmetric and deterministic', () => {
    const a = rich('a', { age: 26, preferences: { minAge: 24, maxAge: 32 } });
    const b = person('b', {
      age: 30,
      traits: traits({
        ...Object.fromEntries(Object.entries(RICH).map(([k, t]) => [k, t?.value])),
        socialEnergy: 0.25,
        weekendRhythm: 'restful',
      }),
      interests: INTERESTS.slice(0, 3),
    });
    const ab = run(a, b);
    const ba = run(b, a);
    expect(ab.overall).toBe(ba.overall);
    expect(ab.confidence).toBe(ba.confidence);
    expect(ab.scenarios.map((s) => s.alignment)).toEqual(ba.scenarios.map((s) => s.alignment));
    expect(JSON.stringify(run(a, b))).toBe(JSON.stringify(ab));
  });

  it('changing weights changes the score and the recorded weights version', () => {
    const a = rich('a');
    const b = person('b', {
      traits: traits({
        ...Object.fromEntries(Object.entries(RICH).map(([k, t]) => [k, t?.value])),
        emotionalExpressiveness: 0,
        affectionExpression: 0,
        conflictApproach: 0,
      }),
      interests: INTERESTS,
    });
    const base = score(a, b, W, 'v1');
    const emotionHeavy = score(
      a,
      b,
      { ...W, emotional: 0.45, lifestyle: 0.05, intellectual: 0, mutualPreferences: 0 },
      'v2',
    );
    expect(emotionHeavy.overall).toBeLessThan(base.overall ?? 0);
    expect(emotionHeavy.weightsVersion).toBe('v2');
  });

  it('scenarios use only their own features and stay null without enough data', () => {
    const result = run(
      person('a', { traits: traits({ conflictApproach: 1, emotionalExpressiveness: 1 }) }),
      person('b', { traits: traits({ conflictApproach: 0, emotionalExpressiveness: 0.25 }) }),
    );
    const conflict = result.scenarios.find((s) => s.key === 'conflictCommunication');
    expect(conflict?.alignment).toBeCloseTo(0.1, 2);
    expect(conflict?.features.map((f) => f.feature)).toEqual([
      'conflictApproach',
      'emotionalExpressiveness',
    ]);
    expect(result.scenarios.find((s) => s.key === 'weekendTogether')?.alignment).toBeNull();
    // "Priorities and planning" never reads anything about money.
    const finance = run(rich('a'), rich('b')).scenarios.find((s) => s.key === 'financialAttitudes');
    expect(finance?.features.map((f) => f.feature)).toEqual(['planningStyle', 'values']);
  });

  it('explains matches in plain language', () => {
    const result = run(rich('a'), rich('b'));
    const lines = highlights(result, W);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(3);
    // Reasons come from different dimensions before any repeats.
    expect(lines).toContain('You’re looking for the same kind of relationship');
    expect(result.dimensions.relationshipAlignment.aligned).toContain(
      'You’re looking for the same kind of relationship',
    );
    expect(
      result.dimensions.relationshipAlignment.aligned.some((l) => l.startsWith('You both value')),
    ).toBe(true);
  });

  it('stays within the documented ranges for 500 random pairs', () => {
    let seed = 7;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const scale = () => Math.round(random() * 4) / 4;
    const randomPerson = (id: string) =>
      person(id, {
        traits:
          random() < 0.2
            ? {}
            : traits(
                {
                  socialEnergy: scale(),
                  planningStyle: scale(),
                  conflictApproach: scale(),
                  emotionalExpressiveness: scale(),
                  affectionExpression: scale(),
                  communicationStyle: ['concise', 'expansive', 'playful', 'reflective'][
                    Math.floor(random() * 4)
                  ] as string,
                },
                0.3 + random() * 0.65,
              ),
      });
    for (let i = 0; i < 500; i += 1) {
      const result = run(randomPerson(`a${i}`), randomPerson(`b${i}`));
      compatibilityResultSchema.parse(result);
      if (result.sufficiency === 'INSUFFICIENT') expect(result.overall).toBeNull();
      else expect(result.overall).not.toBeNull();
    }
  });
});

describe('ranking', () => {
  const viewer = person('viewer', { traits: RICH, interests: INTERESTS });

  it('prefers a confident estimate over an uncertain higher one, and puts insufficient last', () => {
    const confident = run(viewer, person('c', { traits: RICH, interests: INTERESTS }));
    const sparse = run(
      viewer,
      person('s', {
        traits: traits({
          socialEnergy: 0.75,
          conflictApproach: 0.75,
          communicationStyle: 'expansive',
          emotionalExpressiveness: 0.75,
        }),
      }),
    );
    const none = run(viewer, person('n'));
    expect(rankScore(confident)).toBeGreaterThan(rankScore(sparse));
    expect(rankScore(none)).toBeLessThan(0);
    const order = rankWithDiversity(
      [
        { item: 'n', result: none },
        { item: 's', result: sparse },
        { item: 'c', result: confident },
      ],
      W,
      (x) => x,
    ).map((r) => r.item);
    expect(order).toEqual(['c', 's', 'n']);
  });

  it('is deterministic for ties', () => {
    const result = run(viewer, person('x', { traits: RICH, interests: INTERESTS }));
    const order = rankWithDiversity(
      ['d', 'b', 'c', 'a'].map((item) => ({ item, result })),
      W,
      (x) => x,
    ).map((r) => r.item);
    expect(order).toEqual(['a', 'b', 'c', 'd']);
  });
});
