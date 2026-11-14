import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

import { socialImage } from '@/lib/social-image';

// Drawn once at build time and served as a static file.
export const dynamic = 'force-static';

const size = { width: socialImage.width, height: socialImage.height };

const INK = '#100F13';
const IVORY = '#F5F0EA';
const CHERRY = '#D4203A';
const CHERRY_BRIGHT = '#FF5468';
const GREY = '#938D98';

/** The sharing card, drawn at build time from the brand's own type. */
export async function GET() {
  const fonts = join(process.cwd(), 'src/assets/fonts');
  const [regular, italic] = await Promise.all([
    readFile(join(fonts, 'InstrumentSerif_400Regular.ttf')),
    readFile(join(fonts, 'InstrumentSerif_400Regular_Italic.ttf')),
  ]);
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: INK,
        color: IVORY,
        padding: '56px 64px',
        fontFamily: 'Instrument Serif',
        position: 'relative',
      }}
    >
      <svg
        width="1100"
        height="1100"
        viewBox="0 0 1120 1120"
        style={{ position: 'absolute', right: -330, top: -230 }}
      >
        <ellipse
          cx="560"
          cy="560"
          rx="300"
          ry="138"
          transform="rotate(-24 560 560)"
          fill="none"
          stroke="#3A3540"
          strokeWidth="2"
        />
        <ellipse
          cx="560"
          cy="560"
          rx="460"
          ry="212"
          transform="rotate(-15 560 560)"
          fill="none"
          stroke="#3A3540"
          strokeWidth="2"
        />
        <circle cx="560" cy="560" r="7" fill={IVORY} />
        <circle cx="560" cy="560" r="20" fill="none" stroke={CHERRY} strokeWidth="2" />
        <circle cx="460" cy="793" r="12" fill={CHERRY} />
      </svg>
      <div style={{ display: 'flex', fontSize: 44, letterSpacing: 5 }}>VYRA</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 168, lineHeight: 0.9, letterSpacing: -5 }}>
          Chemistry,
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 168,
            lineHeight: 0.9,
            letterSpacing: -5,
            fontStyle: 'italic',
            color: CHERRY_BRIGHT,
          }}
        >
          decoded.
        </div>
        <div style={{ display: 'flex', marginTop: 36, fontSize: 34, color: GREY }}>
          Dating built on compatibility, not swiping.
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Instrument Serif', data: regular, style: 'normal', weight: 400 },
        { name: 'Instrument Serif', data: italic, style: 'italic', weight: 400 },
      ],
    },
  );
}
