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
const MAX_EDGE = 2048;
const MAX_INPUT_EDGE = 8000;
/** Refuse decompression bombs: at most 50 megapixels of input. */
const MAX_INPUT_PIXELS = 50_000_000;

export interface UploadedImage {
  readonly buffer: Buffer;
  /** The type the client declared. Must agree with what the bytes are. */
  readonly mimetype: string;
}

export interface ProcessedImage {
  readonly data: Buffer;
  readonly info: OutputInfo;
  readonly contentHash: string;
}

/**
 * Checks the declared type, then what the bytes really are, then size and
 * dimensions, and re-encodes to JPEG. Re-encoding drops EXIF (including GPS
 * position) and anything else hidden in the original file.
 */
export async function processImage(input: UploadedImage, minEdge: number): Promise<ProcessedImage> {
  if (!(ACCEPTED_PHOTO_MIME_TYPES as readonly string[]).includes(input.mimetype)) {
    throw new UnsupportedMediaTypeException('Upload a JPEG, PNG or WebP photo.');
  }
  let output: { data: Buffer; info: OutputInfo };
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
    output = await image
      .rotate() // apply EXIF orientation before the metadata is dropped
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('That file could not be read as a photo.');
  }
  return { ...output, contentHash: sha256Hex(output.data) };
}
