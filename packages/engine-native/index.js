// The Rust engine behind the same function signatures as @vyra/compatibility-engine.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const native = require('./binding.cjs');

/** e.g. "compat-2"; must equal ENGINE_VERSION of the TypeScript engine. */
export const ENGINE_VERSION = native.engineVersion();

export function ineligibility(a, b) {
  return native.ineligibility(JSON.stringify(a), JSON.stringify(b)) ?? null;
}

export function score(a, b, weights, weightsVersion) {
  return JSON.parse(
    native.score(JSON.stringify(a), JSON.stringify(b), JSON.stringify(weights), weightsVersion),
  );
}

export function highlights(result, weights, max = 3) {
  return native.highlights(JSON.stringify(result), JSON.stringify(weights), max);
}

export function scoreMany(viewer, candidates, weights, weightsVersion) {
  return JSON.parse(
    native.scoreMany(
      JSON.stringify(viewer),
      JSON.stringify(candidates),
      JSON.stringify(weights),
      weightsVersion,
    ),
  );
}

export function rankWithDiversity(items, weights, keyOf) {
  const order = native.rankWithDiversity(
    JSON.stringify(items.map((entry) => [keyOf(entry.item), entry.result])),
    JSON.stringify(weights),
  );
  return order.map((index) => items[index]);
}

/** Gate, score, rank and explain in Rust; returns only the top `limit`. */
export function recommend(viewer, candidates, weights, weightsVersion, limit) {
  return JSON.parse(
    native.recommend(
      JSON.stringify(viewer),
      JSON.stringify(candidates),
      JSON.stringify(weights),
      weightsVersion,
      limit,
    ),
  );
}

export function ineligibilityMany(viewer, candidates) {
  return native
    .ineligibilityMany(JSON.stringify(viewer), JSON.stringify(candidates))
    .map((reason) => reason ?? null);
}

/** Learns proposed dimension weights from decisions, within the engine's guardrails. */
export function fitWeights(samples, current, options) {
  return JSON.parse(
    native.fitWeights(JSON.stringify(samples), JSON.stringify(current), JSON.stringify(options)),
  );
}
