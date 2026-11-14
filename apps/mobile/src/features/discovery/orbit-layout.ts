/**
 * Places people around you in Orbit. Pure and deterministic, so the same
 * recommendations always draw the same picture and it can be unit-tested.
 *
 * - Distance from the centre encodes estimated alignment: closer = higher.
 * - People with too little data sit on the outer ring, never near the centre.
 * - The angle comes from a hash of the person's id (stable between visits),
 *   nudged until nodes don't overlap.
 */
export interface OrbitInput {
  readonly id: string;
  readonly overall: number | null;
}

export interface OrbitNode {
  readonly id: string;
  /** Position relative to the centre, in the same units as `size`. */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Which ring, 0 = innermost. */
  readonly ring: number;
}

export interface OrbitGeometry {
  /** Ring radii from the centre outwards. The last ring holds "not enough to say". */
  readonly rings: readonly number[];
  readonly nodes: readonly OrbitNode[];
  /**
   * Distance from the centre to the edge of the outermost node. Normally `size / 2`; larger
   * when so many people share the outer bands that they spill beyond it.
   */
  readonly extent: number;
}

const RING_COUNT = 4;

function hash(text: string): number {
  // FNV-1a, 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Ring for an estimate: ≥ 0.75 innermost … < 0.45 third; null on the outer ring. */
export function ringFor(overall: number | null): number {
  if (overall === null) return RING_COUNT - 1;
  if (overall >= 0.75) return 0;
  if (overall >= 0.6) return 1;
  return 2;
}

export function layoutOrbit(
  people: readonly OrbitInput[],
  size: number,
  nodeSize: number,
): OrbitGeometry {
  const outer = size / 2 - nodeSize / 2;
  const inner = outer * 0.32;
  const rings = Array.from(
    { length: RING_COUNT },
    (_, i) => inner + ((outer - inner) * i) / (RING_COUNT - 1),
  );
  const placed: OrbitNode[] = [];
  const minGap = nodeSize * 1.1;

  // Most aligned first, so they get first pick of their positions.
  const ordered = people.toSorted(
    (a, b) => (b.overall ?? -1) - (a.overall ?? -1) || a.id.localeCompare(b.id),
  );
  for (const person of ordered) {
    const ring = ringFor(person.overall);
    // Within a ring, a higher estimate sits slightly further in.
    const band = (rings[1] ?? 0) - (rings[0] ?? 0);
    const within = person.overall === null ? 0 : (1 - Math.min(1, person.overall)) * band * 0.3;
    let radius = (rings[ring] ?? outer) - band * 0.15 + within;
    radius = Math.min(outer, Math.max(inner * 0.9, radius));
    let angle = ((hash(person.id) % 3600) / 3600) * Math.PI * 2;
    const step = Math.max(0.05, minGap / radius);
    let x = radius * Math.cos(angle);
    let y = radius * Math.sin(angle);
    for (
      let tries = 0;
      tries < 2000 && placed.some((n) => Math.hypot(n.x - x, n.y - y) < minGap);
      tries += 1
    ) {
      angle += step;
      // After a full turn, step outwards rather than overlap — past the outer ring if it is
      // full. The canvas grows to fit (see `extent`), so nobody is ever drawn on top of anyone.
      if (tries > 0 && tries % Math.ceil((Math.PI * 2) / step) === 0) radius += nodeSize * 0.6;
      x = radius * Math.cos(angle);
      y = radius * Math.sin(angle);
    }
    placed.push({ id: person.id, x, y, radius, ring });
  }
  const extent = Math.max(size / 2, ...placed.map((n) => n.radius + nodeSize / 2));
  return { rings, nodes: placed, extent };
}
