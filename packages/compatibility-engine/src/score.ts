import {
  COMPATIBILITY_DIMENSIONS,
  COMPATIBILITY_SCENARIOS,
  type CompatibilityDimension,
  type CompatibilityResult,
  type CompatibilityScenario,
  type DimensionResult,
  type ScenarioResult,
  type Sufficiency,
} from '@vyra/validation';
import { compareAll, type Comparison, type FeatureKey, sharedInterestLabels } from './features.js';
import type { Person, Weights } from './types.js';

export const ENGINE_VERSION = 'compat-1';

type FeatureWeights = Readonly<Partial<Record<FeatureKey, number>>>;

/** Which features make up each dimension, and their relative weight inside it. */
export const DIMENSION_FEATURES: Readonly<Record<CompatibilityDimension, FeatureWeights>> = {
  emotional: { emotionalExpressiveness: 1, affectionExpression: 1, conflictApproach: 1 },
  communication: { communicationStyle: 2, conflictApproach: 1 },
  lifestyle: { socialEnergy: 1, lifestylePace: 1, weekendRhythm: 1, planningStyle: 1 },
  relationshipAlignment: { intents: 2, values: 1 },
  intellectual: { intellectualCuriosity: 1, adventureOrientation: 1, sharedInterests: 1 },
  mutualPreferences: { preferenceFit: 1 },
};

/** Explicit features for each scenario. Nothing is simulated. */
export const SCENARIO_FEATURES: Readonly<Record<CompatibilityScenario, FeatureWeights>> = {
  firstDate: { communicationStyle: 0.4, socialEnergy: 0.3, sharedInterests: 0.3 },
  weekendTogether: { weekendRhythm: 0.4, lifestylePace: 0.3, socialEnergy: 0.3 },
  longDistance: {
    communicationStyle: 0.3,
    emotionalExpressiveness: 0.3,
    affectionExpression: 0.2,
    planningStyle: 0.2,
  },
  conflictCommunication: { conflictApproach: 0.6, emotionalExpressiveness: 0.4 },
  socialLifestyle: { socialEnergy: 0.5, lifestylePace: 0.5 },
  // Uses planning style and stated values only. VYRA holds no financial information.
  financialAttitudes: { planningStyle: 0.5, values: 0.5 },
  futurePlanning: { intents: 0.5, planningStyle: 0.3, values: 0.2 },
  spontaneousTravel: { adventureOrientation: 0.5, planningStyle: 0.3, sharedInterests: 0.2 },
  personalBoundaries: { conflictApproach: 0.5, emotionalExpressiveness: 0.5 },
  dailyRoutines: { planningStyle: 0.4, lifestylePace: 0.3, socialEnergy: 0.3 },
};

/** Weighted data coverage below which no overall number is given. */
export const INSUFFICIENT_BELOW = 0.4;
/** Weighted data coverage below which the result is marked partial. */
export const PARTIAL_BELOW = 0.7;
/** A scenario needs at least this share of its feature weight known. */
export const SCENARIO_MIN_COVERAGE = 0.5;

const round = (n: number) => Math.round(n * 1000) / 1000;

interface Aggregate {
  readonly score: number | null;
  readonly confidence: number;
  readonly coverage: number;
  readonly used: [FeatureKey, Comparison][];
}

/** Confidence-weighted mean over the features known for both people. */
function aggregate(
  features: FeatureWeights,
  comparisons: ReadonlyMap<FeatureKey, Comparison>,
): Aggregate {
  const entries = Object.entries(features) as [FeatureKey, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const used = entries.flatMap(([key, w]) => {
    const c = comparisons.get(key);
    return c ? [[key, w, c] as const] : [];
  });
  const knownWeight = used.reduce((s, [, w]) => s + w, 0);
  const coverage = total === 0 ? 0 : knownWeight / total;
  const weightedConfidence = used.reduce((s, [, w, c]) => s + w * c.confidence, 0);
  const mean =
    weightedConfidence === 0
      ? null
      : used.reduce((s, [, w, c]) => s + w * c.confidence * c.similarity, 0) / weightedConfidence;
  const meanConfidence = knownWeight === 0 ? 0 : weightedConfidence / knownWeight;
  return {
    score: mean === null ? null : round(mean),
    confidence: round(meanConfidence * coverage),
    coverage: round(coverage),
    used: used.map(([key, , c]) => [key, c]),
  };
}

function sufficiencyFor(dataCoverage: number): Sufficiency {
  if (dataCoverage < INSUFFICIENT_BELOW) return 'INSUFFICIENT';
  if (dataCoverage < PARTIAL_BELOW) return 'PARTIAL';
  return 'SUFFICIENT';
}

/**
 * Estimated alignment between two people who have already passed
 * `ineligibility`. Deterministic and symmetric in what it computes, so the
 * same pair always gets the same result.
 *
 * C(A,B) = Σ wᵢ·sᵢ / Σ wᵢ over dimensions with data, then pulled towards 0.5
 * in proportion to missing data, so sparse profiles can never look like a
 * strong match. Below INSUFFICIENT_BELOW no overall number is produced.
 */
export function score(
  a: Person,
  b: Person,
  weights: Weights,
  weightsVersion: string,
): CompatibilityResult {
  const comparisons = compareAll(a, b);

  const dimensions = {} as Record<CompatibilityDimension, DimensionResult>;
  let weighted = 0;
  let weightWithData = 0;
  let confidence = 0;
  let dataCoverage = 0;
  for (const dimension of COMPATIBILITY_DIMENSIONS) {
    const agg = aggregate(DIMENSION_FEATURES[dimension], comparisons);
    const w = weights[dimension];
    dimensions[dimension] = {
      score: agg.score,
      confidence: agg.confidence,
      coverage: agg.coverage,
      features: agg.used.map(([feature, c]) => ({
        feature,
        similarity: c.similarity,
        confidence: c.confidence,
      })),
      aligned: agg.used.flatMap(([, c]) => (c.aligned ? [c.aligned] : [])),
      different: agg.used.flatMap(([, c]) => (c.different ? [c.different] : [])),
    };
    if (agg.score !== null) {
      weighted += w * agg.score;
      weightWithData += w;
    }
    confidence += w * agg.confidence;
    dataCoverage += w * agg.coverage;
  }

  const sufficiency = sufficiencyFor(dataCoverage);
  const raw = weightWithData === 0 ? null : weighted / weightWithData;
  const overall =
    sufficiency === 'INSUFFICIENT' || raw === null
      ? null
      : round(0.5 + (raw - 0.5) * Math.min(1, dataCoverage));

  const scenarios: ScenarioResult[] = COMPATIBILITY_SCENARIOS.map((key) => {
    const agg = aggregate(SCENARIO_FEATURES[key], comparisons);
    return {
      key,
      alignment: agg.coverage >= SCENARIO_MIN_COVERAGE ? agg.score : null,
      confidence: agg.confidence,
      features: agg.used.map(([feature, c]) => ({
        feature,
        similarity: c.similarity,
        confidence: c.confidence,
      })),
    };
  });

  return {
    engineVersion: ENGINE_VERSION,
    weightsVersion,
    overall,
    confidence: round(confidence),
    sufficiency,
    dimensions,
    scenarios,
    sharedInterests: sharedInterestLabels(a, b),
  };
}

/** The strongest two or three reasons, for a recommendation card. */
export function highlights(result: CompatibilityResult, weights: Weights, max = 3): string[] {
  const ranked = COMPATIBILITY_DIMENSIONS.filter(
    (d) => result.dimensions[d].score !== null,
  ).toSorted(
    (x, y) =>
      weights[y] * (result.dimensions[y].score ?? 0) -
      weights[x] * (result.dimensions[x].score ?? 0),
  );
  // One reason per dimension first, so a card doesn't repeat the same idea three times.
  const reasons: string[] = [];
  for (let pass = 0; reasons.length < max; pass += 1) {
    let added = false;
    for (const dimension of ranked) {
      const line = result.dimensions[dimension].aligned[pass];
      if (line !== undefined && reasons.length < max && !reasons.includes(line)) {
        reasons.push(line);
        added = true;
      }
    }
    if (!added) break;
  }
  return reasons;
}
