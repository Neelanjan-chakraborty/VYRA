#!/usr/bin/env node
/**
 * Turns the licensed stock photographs into web-sized masters in
 * src/assets/photos: longest edge capped, camera metadata (EXIF, GPS) removed,
 * progressive JPEG. Next's image optimiser then serves AVIF/WebP at each
 * visitor's size from these masters.
 *
 *   node scripts/build-photos.mjs <directory with the original p<id>.jpg files>
 *
 * The originals are large (up to 18 MB) and are not committed. Provenance,
 * licence and credit for every photograph is in src/content/photos.ts.
 */
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/build-photos.mjs <directory of originals>');
  process.exit(2);
}
const out = fileURLToPath(new URL('../src/assets/photos/', import.meta.url));
mkdirSync(out, { recursive: true });

/** Stock item id → descriptive file name. Names are part of the image's SEO: they appear in the served URL. */
const photos = [
  ['6440799', 'woman-phone-red-neon-night-street'],
  ['15855621', 'woman-checking-phone-night-city'],
  ['25623432', 'couple-sharing-dessert-restaurant'],
  ['27771103', 'woman-with-phone-restaurant-plants'],
  ['25761888', 'friends-laughing-pizza-restaurant'],
  ['38689346', 'friends-selfie-night-street'],
  ['21077079', 'couple-walking-talking-city-night'],
  ['1300900', 'couple-laughing-in-bar'],
];

const LONG_EDGE = 2200;
for (const [id, name] of photos) {
  const file = join(out, `${name}.jpg`);
  const info = await sharp(join(source, `p${id}.jpg`))
    .rotate() // honour the camera's orientation, then drop the tag
    .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true, progressive: true })
    .toFile(file); // no .withMetadata(): EXIF and GPS are not written
  console.log(
    `${name}.jpg  ${info.width}×${info.height}  ${Math.round(statSync(file).size / 1024)} KB`,
  );
}
