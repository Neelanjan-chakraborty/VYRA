import {
  COMPATIBILITY_DIMENSIONS,
  type CompatibilityDimension,
  type CompatibilityResult,
} from '@vyra/validation';
import type { Weights } from './types.js';

export interface Ranked<T> {
  readonly item: T;
  readonly result: CompatibilityResult;
}

/**
 * Sort key: the estimate discounted by how unsure it is. A confident 0.7
 * outranks an uncertain 0.8. Insufficient-data results sort last.
 */
export function rankScore(result: CompatibilityResult): number {
  if (result.overall === null) return -1 + result.confidence;
  return result.overall * (0.5 + 0.5 * result.confidence);
}

function strongestDimension(
  result: CompatibilityResult,
  weights: Weights,
): CompatibilityDimension | null {
  let best: CompatibilityDimension | null = null;
  let bestValue = -1;
  for (const d of COMPATIBILITY_DIMENSIONS) {
    const value = weights[d] * (result.dimensions[d].score ?? -1);
    if (value > bestValue) {
      best = d;
      bestValue = value;
    }
  }
  return best;
}

/** Penalty for repeating the previous pick's strongest dimension. */
export const DIVERSITY_PENALTY = 0.05;

/**
 * Orders candidates by `rankScore`, then greedily avoids serving several
 * people in a row who are similar to the viewer for the same reason.
 * Deterministic: ties break on the candidate key.
 */
export function rankWithDiversity<T>(
  items: readonly Ranked<T>[],
  weights: Weights,
  keyOf: (item: T) => string,
): Ranked<T>[] {
  const remaining = [...items];
  const out: Ranked<T>[] = [];
  let previous: CompatibilityDimension | null = null;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestValue = Number.NEGATIVE_INFINITY;
    remaining.forEach((entry, index) => {
      const penalty =
        previous !== null && strongestDimension(entry.result, weights) === previous
          ? DIVERSITY_PENALTY
          : 0;
      const value = rankScore(entry.result) - penalty;
      const better =
        value > bestValue ||
        (value === bestValue &&
          keyOf(entry.item) < keyOf((remaining[bestIndex] as Ranked<T>).item));
      if (better) {
        bestIndex = index;
        bestValue = value;
      }
    });
    const [picked] = remaining.splice(bestIndex, 1) as [Ranked<T>];
    out.push(picked);
    previous = strongestDimension(picked.result, weights);
  }
  return out;
}
