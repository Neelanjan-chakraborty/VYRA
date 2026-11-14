/**
 * Motion conventions. Every animation must communicate a state change;
 * when the user prefers reduced motion, use `resolveDuration` so movement
 * collapses to an instant change (opacity fades may keep `duration.fast`).
 */
export const duration = {
  instant: 0,
  fast: 140,
  base: 240,
  slow: 420,
  cinematic: 900,
} as const;
export type DurationToken = keyof typeof duration;

/** Cubic bezier control points, usable with Reanimated's `Easing.bezier`. */
export const easing = {
  standard: [0.2, 0, 0, 1],
  enter: [0, 0, 0, 1],
  exit: [0.3, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type EasingToken = keyof typeof easing;

export function resolveDuration(token: DurationToken, reduceMotion: boolean): number {
  return reduceMotion ? duration.instant : duration[token];
}
