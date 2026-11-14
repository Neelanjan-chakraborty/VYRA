/**
 * Raw palette. Components must not import this directly — use the semantic
 * `color` tokens below so accents stay rare and meaningful.
 */
export const palette = {
  obsidian: '#100F13',
  charcoal: '#19171D',
  charcoalRaised: '#221F27',
  hairline: '#2E2A34',
  violet: '#A77AE8',
  violetDeep: '#7C55BF',
  burgundy: '#672E4B',
  burgundyBright: '#CF789C',
  ivory: '#F5F0EA',
  grey: '#938D98',
  greyDim: '#6B6670',
  amber: '#D9A860',
  sage: '#8FB59A',
} as const;

/**
 * Semantic colour tokens (dark theme — VYRA's only theme for now).
 *
 * Usage rules:
 * - `accent` (violet) marks the single primary action or the active state on a screen.
 * - `chemistry` (burgundy) is reserved for compatibility and connection moments.
 * - Everything else is ivory or grey on obsidian. No decorative gradients.
 */
export const color = {
  background: palette.obsidian,
  surface: palette.charcoal,
  surfaceRaised: palette.charcoalRaised,
  border: palette.hairline,

  textPrimary: palette.ivory,
  textSecondary: palette.grey,
  textDisabled: palette.greyDim,
  textOnAccent: palette.obsidian,

  accent: palette.violet,
  accentPressed: palette.violetDeep,
  chemistry: palette.burgundy,
  chemistryText: palette.burgundyBright,

  success: palette.sage,
  warning: palette.amber,
  danger: '#E0736B',

  scrim: 'rgba(16, 15, 19, 0.72)',
} as const;

export type ColorToken = keyof typeof color;
