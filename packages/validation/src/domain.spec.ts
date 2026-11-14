import { describe, expect, it } from 'vitest';
import {
  COMPATIBILITY_DIMENSIONS,
  DEFAULT_COMPATIBILITY_WEIGHTS,
  compatibilityWeightsSchema,
} from './domain.js';

describe('compatibility weights', () => {
  it('default weights are valid and sum to 1', () => {
    expect(compatibilityWeightsSchema.parse(DEFAULT_COMPATIBILITY_WEIGHTS)).toEqual(
      DEFAULT_COMPATIBILITY_WEIGHTS,
    );
  });

  it('covers every dimension exactly once', () => {
    expect(Object.keys(DEFAULT_COMPATIBILITY_WEIGHTS).toSorted()).toEqual(
      [...COMPATIBILITY_DIMENSIONS].toSorted(),
    );
  });

  it('rejects weights that do not sum to 1', () => {
    const result = compatibilityWeightsSchema.safeParse({
      ...DEFAULT_COMPATIBILITY_WEIGHTS,
      emotional: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range weights', () => {
    const result = compatibilityWeightsSchema.safeParse({
      ...DEFAULT_COMPATIBILITY_WEIGHTS,
      emotional: -0.25,
      communication: 0.7,
    });
    expect(result.success).toBe(false);
  });
});
