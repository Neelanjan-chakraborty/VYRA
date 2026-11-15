// Generates the parity fixtures the Rust engine is tested against, using the
// TypeScript engine as the reference. Deterministic: same seed, same file.
// Usage: node scripts/engine-fixtures.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import {
  highlights,
  ineligibility,
  rankWithDiversity,
  score,
} from '../packages/compatibility-engine/dist/index.js';
import { randomPerson, rng, WEIGHT_SETS } from './engine-people.mjs';

const PAIRS = 2000;
const RANKINGS = 60;
const CANDIDATES = 40;

const r = rng(20261115);
const pairs = [];
for (let i = 0; i < PAIRS; i += 1) {
  const a = randomPerson(r, `a-${String(i).padStart(5, '0')}`);
  // Some pairs compare a person with themselves under another id, some reuse ids.
  const b = i % 97 === 0 ? { ...a } : randomPerson(r, `b-${String(i).padStart(5, '0')}`);
  const { version, weights } = WEIGHT_SETS[i % WEIGHT_SETS.length];
  const result = score(a, b, weights, version);
  pairs.push({
    a,
    b,
    weights,
    weightsVersion: version,
    ineligibility: ineligibility(a, b),
    result,
    highlights: highlights(result, weights),
  });
}

const rankings = [];
for (let i = 0; i < RANKINGS; i += 1) {
  const viewer = randomPerson(r, `v-${i}`);
  const { version, weights } = WEIGHT_SETS[i % WEIGHT_SETS.length];
  const items = [];
  for (let j = 0; j < CANDIDATES; j += 1) {
    // Shuffled ids so ties must break on the key, not the input order.
    const candidate = randomPerson(r, `c-${Math.floor(r() * 1e6)}-${j}`);
    items.push({ key: candidate.id, result: score(viewer, candidate, weights, version) });
  }
  const ranked = rankWithDiversity(
    items.map((item) => ({ item: item.key, result: item.result })),
    weights,
    (key) => key,
  ).map((entry) => entry.item);
  rankings.push({ weights, items, ranked });
}

const target = new URL('../crates/vyra-engine/tests/fixtures/parity.json.gz', import.meta.url);
const json = JSON.stringify({ pairs, rankings });
if (process.argv.includes('--check')) {
  if (gunzipSync(readFileSync(target)).toString() !== json) {
    console.error('Parity fixtures are out of date: run pnpm engine:fixtures');
    process.exit(1);
  }
} else {
  writeFileSync(target, gzipSync(json, { level: 9 }));
  const eligible = pairs.filter((p) => p.ineligibility === null).length;
  console.log(`${pairs.length} pairs (${eligible} eligible), ${rankings.length} rankings`);
}
