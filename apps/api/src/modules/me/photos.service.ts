import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MAX_PHOTOS, type Photo } from '@vyra/validation';
import sharp, { type OutputInfo } from 'sharp';
import { PrismaService } from '../../database/prisma.service.js';
import type { UserPhoto } from '../../generated/prisma/client.js';
import { sha256Hex } from '../auth/crypto.js';
import { MediaUrlService } from '../storage/media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.js';

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_EDGE = 2048;
const MIN_EDGE = 400;
/** Refuse decompression bombs: at most 50 megapixels of input. */
const MAX_INPUT_PIXELS = 50_000_000;
/** Offset used to move photos out of the way while reordering. */
const REORDER_OFFSET = 1000;

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly urls: MediaUrlService,
  ) {}

  toDto(photo: UserPhoto): Photo {
    return {
      id: photo.id,
      position: photo.position,
      width: photo.width,
      height: photo.height,
      url: this.urls.sign(photo.storageKey),
    };
  }

  async list(userId: string): Promise<Photo[]> {
    const photos = await this.prisma.userPhoto.findMany({
      where: { userId, deletedAt: null },
      orderBy: { position: 'asc' },
    });
    return photos.map((photo) => this.toDto(photo));
  }

  /**
   * Accepts an upload by what the bytes are, not what the client says they are,
   * then re-encodes to JPEG. Re-encoding drops EXIF (including GPS position)
   * and anything else hidden in the original file.
   */
  async upload(userId: string, input: Buffer): Promise<Photo> {
    let output: { data: Buffer; info: OutputInfo };
    try {
      const image = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });
      const metadata = await image.metadata();
      if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
        throw new BadRequestException('Upload a JPEG, PNG or WebP photo.');
      }
      if (Math.min(metadata.width ?? 0, metadata.height ?? 0) < MIN_EDGE) {
        throw new BadRequestException(`Photos must be at least ${MIN_EDGE} pixels on each side.`);
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

    const contentHash = sha256Hex(output.data);
    const live = await this.prisma.userPhoto.findMany({
      where: { userId, deletedAt: null },
      select: { position: true, contentHash: true },
    });
    if (live.length >= MAX_PHOTOS) {
      throw new ConflictException(`You can have up to ${MAX_PHOTOS} photos. Remove one first.`);
    }
    if (live.some((photo) => photo.contentHash === contentHash)) {
      throw new ConflictException('You have already added this photo.');
    }

    const id = crypto.randomUUID();
    const storageKey = `photos/${userId}/${id}.jpg`;
    await this.storage.put(storageKey, output.data, 'image/jpeg');
    try {
      const photo = await this.prisma.userPhoto.create({
        data: {
          id,
          userId,
          storageKey,
          position: Math.max(-1, ...live.map((p) => p.position)) + 1,
          width: output.info.width,
          height: output.info.height,
          mimeType: 'image/jpeg',
          sizeBytes: output.data.byteLength,
          contentHash,
        },
      });
      return this.toDto(photo);
    } catch (error) {
      await this.storage.delete(storageKey);
      throw error;
    }
  }

  /** Reorders photos. The list must name every one of the caller's photos exactly once. */
  async reorder(userId: string, photoIds: readonly string[]): Promise<Photo[]> {
    const live = await this.prisma.userPhoto.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    const owned = new Set(live.map((photo) => photo.id));
    if (photoIds.length !== owned.size || photoIds.some((id) => !owned.has(id))) {
      throw new BadRequestException('The order must list each of your photos exactly once.');
    }
    await this.prisma.$transaction([
      this.prisma.userPhoto.updateMany({
        where: { userId, deletedAt: null },
        data: { position: { increment: REORDER_OFFSET } },
      }),
      ...photoIds.map((id, position) =>
        this.prisma.userPhoto.updateMany({ where: { id, userId }, data: { position } }),
      ),
    ]);
    return this.list(userId);
  }

  async remove(userId: string, photoId: string): Promise<void> {
    // Scoped by owner: someone else's photo id behaves exactly like a missing one.
    const photo = await this.prisma.userPhoto.findFirst({
      where: { id: photoId, userId, deletedAt: null },
    });
    if (!photo) throw new NotFoundException('Photo not found.');
    await this.prisma.userPhoto.delete({ where: { id: photo.id } });
    await this.storage.delete(photo.storageKey);
  }

  /** Removes every photo and file for an account that is being deleted. */
  async purge(userId: string): Promise<void> {
    const photos = await this.prisma.userPhoto.findMany({ where: { userId } });
    await this.prisma.userPhoto.deleteMany({ where: { userId } });
    await Promise.all(photos.map((photo) => this.storage.delete(photo.storageKey)));
  }
}
