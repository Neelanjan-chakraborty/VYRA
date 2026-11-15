import sharp from 'sharp';
import { AVIF } from './image.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Kabir · 15 Nov": the recipient's first name and the date it was sent. */
export function watermarkText(displayName: string, at: Date): string {
  const first = displayName.trim().split(/\s+/)[0] || 'Private';
  return `${first} · ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.codePointAt(0)};`);
}

/**
 * A transparent PNG the size of the media, with the text tiled faintly on a
 * diagonal. Faint enough to see through, present enough to survive a crop.
 */
export async function watermarkOverlay(width: number, height: number, text: string) {
  const size = Math.max(14, Math.round(Math.min(width, height) / 18));
  const stepX = Math.round(size * (text.length * 0.62 + 3));
  const stepY = Math.round(size * 4);
  const rows: string[] = [];
  for (let y = -height; y < height * 2; y += stepY)
    for (let x = -width; x < width * 2; x += stepX)
      rows.push(`<text x="${x}" y="${y}">${escapeXml(text)}</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<g transform="rotate(-30 ${width / 2} ${height / 2})" font-family="sans-serif" font-size="${size}"
 fill="#ffffff" fill-opacity="0.22" stroke="#000000" stroke-opacity="0.12" stroke-width="1">${rows.join('')}</g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** The same AVIF image with the recipient's watermark drawn into its pixels. */
export async function watermarkImage(avif: Buffer, text: string): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(avif).metadata();
  const overlay = await watermarkOverlay(width, height, text);
  return sharp(avif)
    .composite([{ input: overlay }])
    .avif(AVIF)
    .toBuffer();
}

/** A tiny, heavily blurred version shown until media is opened or tapped (~1 KB). */
export async function blurredPreview(image: Buffer): Promise<Buffer> {
  return sharp(image)
    .resize({ width: 48, height: 48, fit: 'inside' })
    .blur(3)
    .avif({ quality: 40, effort: 0 })
    .toBuffer();
}
