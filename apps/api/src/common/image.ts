import { BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ACCEPTED_PHOTO_MIME_TYPES } from '@vyra/validation';
import sharp, { type OutputInfo } from 'sharp';
import { sha256Hex } from '../modules/auth/crypto.js';

/** sharp format name → the MIME type a client must declare for it. */
const FORMAT_MIME: Readonly<Record<string, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
/** Full-size photos: plenty for a phone screen at 3× density. */
const MAX_EDGE = 1600;
/** Thumbnails for lists, cards, avatars and message bubbles (crisp at 2× up to 160 pt). */
const THUMB_EDGE = 320;
/**
 * AVIF settings. Measured here on a 1600 px photo: ~60 % smaller than JPEG
 * q86 at the same ~0.2 s encode time. Higher `effort` saves more but takes
 * seconds per upload, so it isn't used on the request path.
 */
const AVIF = { quality: 55, effort: 0 } as const;
const MAX_INPUT_EDGE = 8000;
/** Refuse decompression bombs: at most 50 megapixels of input. */
const MAX_INPUT_PIXELS = 50_000_000;

export interface UploadedImage {
  readonly buffer: Buffer;
  /** The type the client declared. Must agree with what the bytes are. */
  readonly mimetype: string;
}

export interface ProcessedImage {
  /** Full size, AVIF. */
  readonly data: Buffer;
  readonly info: OutputInfo;
  /** 320 px on the long edge, AVIF. */
  readonly thumb: Buffer;
  readonly contentHash: string;
}

export const IMAGE_FORMAT = { extension: 'avif', contentType: 'image/avif' } as const;

/**
 * Checks the declared type, then what the bytes really are, then size and
 * dimensions, and re-encodes to AVIF plus a thumbnail. Re-encoding drops EXIF
 * (including GPS position) and anything else hidden in the original file.
 */
export async function processImage(input: UploadedImage, minEdge: number): Promise<ProcessedImage> {
  if (!(ACCEPTED_PHOTO_MIME_TYPES as readonly string[]).includes(input.mimetype)) {
    throw new UnsupportedMediaTypeException('Upload a JPEG, PNG or WebP photo.');
  }
  let output: { data: Buffer; info: OutputInfo };
  let thumb: Buffer;
  try {
    const image = sharp(input.buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });
    const metadata = await image.metadata();
    const actualMime = metadata.format ? FORMAT_MIME[metadata.format] : undefined;
    if (!actualMime) throw new BadRequestException('Upload a JPEG, PNG or WebP photo.');
    if (actualMime !== input.mimetype) {
      throw new BadRequestException('That file isn’t the kind of image it says it is.');
    }
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (Math.min(width, height) < minEdge) {
      throw new BadRequestException(`Photos must be at least ${minEdge} pixels on each side.`);
    }
    if (Math.max(width, height) > MAX_INPUT_EDGE) {
      throw new BadRequestException(`Photos can be at most ${MAX_INPUT_EDGE} pixels on each side.`);
    }
    // Apply EXIF orientation before the metadata is dropped.
    const upright = image.rotate();
    [output, thumb] = await Promise.all([
      upright
        .clone()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .avif(AVIF)
        .toBuffer({ resolveWithObject: true }),
      upright
        .clone()
        .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
        .avif(AVIF)
        .toBuffer(),
    ]);
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('That file could not be read as a photo.');
  }
  return { ...output, thumb, contentHash: sha256Hex(output.data) };
}
