import localFont from 'next/font/local';

/**
 * The app's two families, self-hosted (SIL Open Font License, see src/assets/fonts).
 * Latin subset only; add a subset here when a locale needs one.
 */
export const instrumentSerif = localFont({
  src: [
    {
      path: '../assets/fonts/instrument-serif-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/instrument-serif-latin-400-italic.woff2',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-instrument-serif',
  display: 'swap',
  fallback: ['Iowan Old Style', 'Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

export const manrope = localFont({
  src: '../assets/fonts/manrope-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-manrope',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  adjustFontFallback: 'Arial',
});
