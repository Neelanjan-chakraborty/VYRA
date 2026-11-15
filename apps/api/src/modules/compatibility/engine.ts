import { Logger } from '@nestjs/common';
import * as reference from '@vyra/compatibility-engine';
import type { IneligibleReason, Person, Weights } from '@vyra/compatibility-engine';
import type { CompatibilityResult } from '@vyra/validation';
import type { Env } from '../../config/env.js';

export const ENGINE = Symbol('ENGINE');

export interface Recommended {
  /** Index into the candidates passed in. */
  readonly index: number;
  readonly result: CompatibilityResult;
  readonly highlights: string[];
}

/**
 * The matchmaking core. In production this is the Rust engine running
 * in-process (napi-rs); the TypeScript package is the reference it is tested
 * against value for value, and a development fallback.
 */
export interface Engine {
  readonly impl: 'native' | 'ts';
  readonly version: string;
  ineligibility(a: Person, b: Person): IneligibleReason | null;
  ineligibilityMany(viewer: Person, candidates: readonly Person[]): (IneligibleReason | null)[];
  score(a: Person, b: Person, weights: Weights, weightsVersion: string): CompatibilityResult;
  highlights(result: CompatibilityResult, weights: Weights): string[];
  /** Gate both ways, score, rank with diversity and explain; only the top `limit`. */
  recommend(
    viewer: Person,
    candidates: readonly Person[],
    weights: Weights,
    weightsVersion: string,
    limit: number,
  ): Recommended[];
}

const typescriptEngine: Engine = {
  impl: 'ts',
  version: reference.ENGINE_VERSION,
  ineligibility: reference.ineligibility,
  ineligibilityMany: (viewer, candidates) =>
    candidates.map((c) => reference.ineligibility(viewer, c)),
  score: reference.score,
  highlights: (result, weights) => reference.highlights(result, weights),
  recommend(viewer, candidates, weights, weightsVersion, limit) {
    const eligible = candidates.flatMap((candidate, index) =>
      reference.ineligibility(viewer, candidate) === null
        ? [{ item: index, result: reference.score(viewer, candidate, weights, weightsVersion) }]
        : [],
    );
    return reference
      .rankWithDiversity(eligible, weights, (index) => candidates[index]?.id ?? '')
      .slice(0, limit)
      .map(({ item, result }) => ({
        index: item,
        result,
        highlights: reference.highlights(result, weights),
      }));
  },
};

export async function createEngine(env: Env): Promise<Engine> {
  const logger = new Logger('Engine');
  if (env.ENGINE_IMPL === 'ts') return typescriptEngine;
  try {
    const native = await import('@vyra/engine-native');
    if (native.ENGINE_VERSION !== reference.ENGINE_VERSION)
      throw new Error(`version ${native.ENGINE_VERSION} != ${reference.ENGINE_VERSION}`);
    logger.log(`Rust engine ${native.ENGINE_VERSION} loaded`);
    return {
      impl: 'native',
      version: native.ENGINE_VERSION,
      ineligibility: native.ineligibility,
      ineligibilityMany: native.ineligibilityMany,
      score: native.score,
      highlights: (result, weights) => native.highlights(result, weights),
      recommend: native.recommend,
    };
  } catch (error) {
    if (env.NODE_ENV === 'production')
      throw new Error(`The Rust engine is required in production: ${(error as Error).message}`, {
        cause: error,
      });
    logger.warn(
      `Rust engine unavailable (${(error as Error).message}); using the TypeScript reference. Build it with pnpm --filter @vyra/engine-native build.`,
    );
    return typescriptEngine;
  }
}
