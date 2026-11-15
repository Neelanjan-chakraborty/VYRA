import * as ts from '@vyra/compatibility-engine';
import { describe, expect, it } from 'vitest';
import { randomPerson, rng, WEIGHT_SETS } from '../../scripts/engine-people.mjs';
import * as native from './index.js';

const byId = (id) => id;

// Fresh seeds, not the fixture seed: the addon must agree with TypeScript on people it has never seen.
describe('Rust engine (native addon) vs TypeScript engine', () => {
  it('has the same engine version', () => {
    expect(native.ENGINE_VERSION).toBe(ts.ENGINE_VERSION);
  });

  it('agrees on gates, results and highlights for 3 000 random pairs', () => {
    const r = rng(777);
    for (let i = 0; i < 3000; i += 1) {
      const a = randomPerson(r, `a${i}`);
      const b = randomPerson(r, `b${i}`);
      const { version, weights } = WEIGHT_SETS[i % 2];
      expect(native.ineligibility(a, b)).toBe(ts.ineligibility(a, b));
      const expected = ts.score(a, b, weights, version);
      expect(native.score(a, b, weights, version)).toEqual(expected);
      expect(native.highlights(expected, weights)).toEqual(ts.highlights(expected, weights));
    }
  });

  it('scores a pool and ranks it like the TypeScript engine', () => {
    const r = rng(4242);
    for (let round = 0; round < 20; round += 1) {
      const viewer = randomPerson(r, `v${round}`);
      const pool = Array.from({ length: 150 }, (_, i) => randomPerson(r, `c${round}-${i}`));
      const { version, weights } = WEIGHT_SETS[round % 2];
      const scored = native.scoreMany(viewer, pool, weights, version);
      pool.forEach((candidate, i) => {
        const gate = ts.ineligibility(viewer, candidate);
        expect(scored[i].ineligible).toBe(gate);
        if (gate === null) {
          const expected = ts.score(viewer, candidate, weights, version);
          expect(scored[i].result).toEqual(expected);
          expect(scored[i].highlights).toEqual(ts.highlights(expected, weights));
        }
      });
      const items = pool.map((c, i) => ({
        item: c.id,
        result: scored[i].result ?? ts.score(viewer, c, weights, version),
      }));
      expect(native.rankWithDiversity(items, weights, byId).map((e) => e.item)).toEqual(
        ts.rankWithDiversity(items, weights, byId).map((e) => e.item),
      );
    }
  });

  it('recommends the same top people, in the same order, as the TypeScript pipeline', () => {
    const r = rng(9001);
    for (let round = 0; round < 20; round += 1) {
      const viewer = randomPerson(r, `rv${round}`);
      const pool = Array.from({ length: 120 }, (_, i) => randomPerson(r, `rc${round}-${i}`));
      const { version, weights } = WEIGHT_SETS[round % 2];
      const eligible = pool
        .filter((c) => ts.ineligibility(viewer, c) === null)
        .map((c) => ({ item: c.id, result: ts.score(viewer, c, weights, version) }));
      const expected = ts.rankWithDiversity(eligible, weights, (id) => id).slice(0, 25);
      const actual = native.recommend(viewer, pool, weights, version, 25);
      expect(actual.map((x) => pool[x.index].id)).toEqual(expected.map((e) => e.item));
      actual.forEach((x, i) => {
        expect(x.result).toEqual(expected[i].result);
        expect(x.highlights).toEqual(ts.highlights(expected[i].result, weights));
      });
      expect(native.ineligibilityMany(viewer, pool)).toEqual(
        pool.map((c) => ts.ineligibility(viewer, c)),
      );
    }
  });

  it('rejects malformed input instead of guessing', () => {
    expect(() => native.score({ id: 'x' }, { id: 'y' }, WEIGHT_SETS[0].weights, 'v')).toThrow(
      /invalid person/,
    );
  });
});
