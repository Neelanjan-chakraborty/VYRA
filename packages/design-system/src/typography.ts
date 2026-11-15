/**
 * Two families: an editorial serif for display copy and a geometric sans for
 * interface text. Family names match the fonts loaded by the mobile app.
 */
export const fontFamily = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'Manrope_400Regular',
  sansMedium: 'Manrope_500Medium',
  sansSemiBold: 'Manrope_600SemiBold',
} as const;

export interface TextStyleToken {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
}

/** Type scale. Sizes are in density-independent pixels. */
export const typography = {
  displayXL: { fontFamily: fontFamily.display, fontSize: 56, lineHeight: 58, letterSpacing: -1.2 },
  displayL: { fontFamily: fontFamily.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  displayM: { fontFamily: fontFamily.display, fontSize: 30, lineHeight: 35, letterSpacing: -0.4 },
  title: { fontFamily: fontFamily.sansSemiBold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  titleSmall: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  body: { fontFamily: fontFamily.sans, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyStrong: { fontFamily: fontFamily.sansMedium, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  /** Message text: a touch tighter than prose so bubbles feel composed. */
  message: { fontFamily: fontFamily.sans, fontSize: 16, lineHeight: 23, letterSpacing: 0 },
  messageStrong: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: 0,
  },
  caption: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
  captionStrong: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  /** Small uppercase label; render with `textTransform: 'uppercase'`. */
  eyebrow: { fontFamily: fontFamily.sansMedium, fontSize: 11, lineHeight: 14, letterSpacing: 1.6 },
} as const satisfies Record<string, TextStyleToken>;

export type TypographyToken = keyof typeof typography;
