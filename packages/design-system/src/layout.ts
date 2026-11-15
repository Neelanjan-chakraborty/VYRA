/** 4pt spacing scale. */
export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 72,
} as const;
export type SpaceToken = keyof typeof space;

/** Radii are deliberately restrained: VYRA is not a UI of rounded cards. */
export const radius = {
  none: 0,
  s: 4,
  m: 10,
  l: 18,
  xl: 24,
  full: 999,
} as const;
export type RadiusToken = keyof typeof radius;

/** Elevation is expressed through surface colour first, shadow second. */
export const elevation = {
  flat: { shadowOpacity: 0, shadowRadius: 0, shadowOffsetY: 0, androidElevation: 0 },
  raised: { shadowOpacity: 0.32, shadowRadius: 16, shadowOffsetY: 8, androidElevation: 6 },
  overlay: { shadowOpacity: 0.48, shadowRadius: 32, shadowOffsetY: 16, androidElevation: 16 },
} as const;
export type ElevationToken = keyof typeof elevation;

/** Minimum touch target edge, per platform accessibility guidance. */
export const MIN_TOUCH_TARGET = 44;
