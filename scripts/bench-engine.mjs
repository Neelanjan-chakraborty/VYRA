// TypeScript engine vs the Rust addon, measured through the real Node boundary
// (including JSON in and out). Usage: node scripts/bench-engine.mjs
import * as ts from '../packages/compatibility-engine/dist/index.js';
import * as native from '../packages/engine-native/index.js';
import { randomPerson, rng, WEIGHT_SETS } from './engine-people.mjs';

const r = rng(99);
const { version, weights } = WEIGHT_SETS[0];
const viewer = randomPerson(r, 'viewer');
// Open preferences so most of the pool is eligible and gets fully scored.
viewer.preferences = {
  ...viewer.preferences,
  minAge: 18,
  maxAge: 99,
  showGenders: [],
  maxDistanceKm: null,
  criteria: [],
};
const pool = Array.from({ length: 200 }, (_, i) => {
  const p = randomPerson(r, `c${i}`);
  return {
    ...p,
    intents: ['serious'],
    preferences: {
      ...p.preferences,
      minAge: 18,
      maxAge: 99,
      showGenders: [],
      maxDistanceKm: null,
      criteria: [],
    },
  };
});
viewer.intents = ['serious'];

function time(label, fn, iterations) {
  for (let i = 0; i < Math.min(50, iterations); i += 1) fn(); // warm up
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i += 1) fn();
  const perCall = Number(process.hrtime.bigint() - start) / iterations / 1e3;
  console.log(`${label.padEnd(44)} ${perCall.toFixed(1).padStart(9)} µs`);
  return perCall;
}

const LIMIT = 30;

/** What the API does today: gate and score everyone, rank, explain the top 30. */
function tsRecommend() {
  const items = [];
  for (const c of pool) {
    if (ts.ineligibility(viewer, c) !== null) continue;
    items.push({ item: c.id, result: ts.score(viewer, c, weights, version) });
  }
  return ts
    .rankWithDiversity(items, weights, (id) => id)
    .slice(0, LIMIT)
    .map((e) => ({ ...e, highlights: ts.highlights(e.result, weights) }));
}

/** The same in one native call, including JSON in and out. */
function nativeRecommend() {
  return native.recommend(viewer, pool, weights, version, LIMIT);
}

const eligible = pool.filter((c) => ts.ineligibility(viewer, c) === null).length;
console.log(`Pool: ${pool.length} candidates, ${eligible} eligible\n`);
const a = time(
  'TypeScript: score one pair',
  () => ts.score(viewer, pool[0], weights, version),
  20000,
);
const b = time(
  'Rust addon: score one pair (JSON boundary)',
  () => native.score(viewer, pool[0], weights, version),
  20000,
);
const c = time('TypeScript: recommend top 30 of 200', tsRecommend, 300);
const d = time('Rust addon: recommend top 30 of 200', nativeRecommend, 300);
console.log(`\nOne pair: ${(a / b).toFixed(2)}×   Pool of 200: ${(c / d).toFixed(2)}×`);
