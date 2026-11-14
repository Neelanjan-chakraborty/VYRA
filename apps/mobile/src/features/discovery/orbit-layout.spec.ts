import { describe, expect, it } from 'vitest';
import { layoutOrbit, ringFor } from './orbit-layout';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('Orbit layout', () => {
  it('puts higher estimates nearer the centre and "not enough to say" on the outer ring', () => {
    expect([0.9, 0.7, 0.5, null].map(ringFor)).toEqual([0, 1, 2, 3]);
    const { nodes, rings } = layoutOrbit(
      [
        { id: id(1), overall: 0.95 },
        { id: id(2), overall: 0.65 },
        { id: id(3), overall: 0.3 },
        { id: id(4), overall: null },
      ],
      360,
      44,
    );
    const r = (n: number) => nodes.find((node) => node.id === id(n))?.radius ?? 0;
    expect(r(1)).toBeLessThan(r(2));
    expect(r(2)).toBeLessThan(r(3));
    expect(r(3)).toBeLessThan(r(4));
    expect(rings).toHaveLength(4);
  });

  it('is deterministic', () => {
    const people = Array.from({ length: 12 }, (_, i) => ({ id: id(i), overall: (i % 5) / 5 }));
    expect(layoutOrbit(people, 360, 44)).toEqual(layoutOrbit([...people].toReversed(), 360, 44));
  });

  it('does not overlap nodes, even when many share a ring', () => {
    const people = Array.from({ length: 30 }, (_, i) => ({ id: id(i), overall: 0.8 }));
    const { nodes } = layoutOrbit(people, 360, 36);
    for (const a of nodes) {
      for (const b of nodes) {
        if (a.id !== b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(36);
      }
      expect(Math.hypot(a.x, a.y)).toBeLessThanOrEqual(180);
    }
  });

  it('spills beyond the outer ring instead of overlapping when a band is crowded', () => {
    // A phone-sized canvas where 40 people all have "not enough to say".
    const people = Array.from({ length: 40 }, (_, i) => ({ id: id(i), overall: null }));
    const { nodes, extent } = layoutOrbit(people, 342, 60);
    expect(nodes).toHaveLength(40);
    for (const a of nodes) {
      for (const b of nodes) {
        if (a.id !== b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(60);
      }
      expect(Math.hypot(a.x, a.y) + 30).toBeLessThanOrEqual(extent + 1e-9);
    }
    expect(extent).toBeGreaterThan(171);
  });
});
