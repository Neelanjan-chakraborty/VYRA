import type { IneligibleReason, Person, Ranked, Weights } from '@vyra/compatibility-engine';
import type { CompatibilityResult } from '@vyra/validation';

export declare const ENGINE_VERSION: string;
export declare function ineligibility(a: Person, b: Person): IneligibleReason | null;
export declare function score(
  a: Person,
  b: Person,
  weights: Weights,
  weightsVersion: string,
): CompatibilityResult;
export declare function highlights(
  result: CompatibilityResult,
  weights: Weights,
  max?: number,
): string[];
export interface Scored {
  readonly ineligible: IneligibleReason | null;
  readonly result: CompatibilityResult | null;
  readonly highlights: string[];
}
/** Gates, scores and explains every candidate for one viewer in a single native call. */
export declare function scoreMany(
  viewer: Person,
  candidates: readonly Person[],
  weights: Weights,
  weightsVersion: string,
): Scored[];
export declare function rankWithDiversity<T>(
  items: readonly Ranked<T>[],
  weights: Weights,
  keyOf: (item: T) => string,
): Ranked<T>[];
export interface Recommended {
  /** Index into the candidates passed in. */
  readonly index: number;
  readonly result: CompatibilityResult;
  readonly highlights: string[];
}
/** Gate both ways, score, rank with diversity and explain; only the top `limit`. */
export declare function recommend(
  viewer: Person,
  candidates: readonly Person[],
  weights: Weights,
  weightsVersion: string,
  limit: number,
): Recommended[];
export declare function ineligibilityMany(
  viewer: Person,
  candidates: readonly Person[],
): (IneligibleReason | null)[];
