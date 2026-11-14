import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ACCEPTED_PHOTO_MIME_TYPES, MAX_PHOTOS, type Photo } from '@vyra/validation';
import sharp, { type OutputInfo } from 'sharp';
import { PrismaService } from '../../database/prisma.service.js';
import type { UserPhoto } from '../../generated/prisma/client.js';
import { sha256Hex } from '../auth/crypto.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { MediaUrlService } from '../storage/media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.js';

/** sharp format name → the MIME type a client must declare for it. */
const FORMAT_MIME: Readonly<Record<string, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const MAX_EDGE = 2048;
const MIN_EDGE = 400;
const MAX_INPUT_EDGE = 8000;
/** Refuse decompression bombs: at most 50 megapixels of input. */
const MAX_INPUT_PIXELS = 50_000_000;
/** Offset used to move photos out of the way while reordering. */
const REORDER_OFFSET = 1000;

export interface UploadedImage {
  readonly buffer: Buffer;
  /** The type the client declared. Must agree with what the bytes are. */
  readonly mimetype: string;
}

interface ProcessedImage {
  readonly data: Buffer;
  readonly info: OutputInfo;
  readonly contentHash: string;
}

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly urls: MediaUrlService,
    private readonly moderation: ModerationService,
  ) {}

  /** The owner's view of their own photo. The URL works only for them (owner scope). */
  toDto(photo: UserPhoto): Photo {
    return {
      id: photo.id,
      position: photo.position,
      width: photo.width,
      height: photo.height,
      url: this.urls.sign(photo.storageKey, 'owner'),
      status: photo.moderationStatus,
      reason: photo.moderationStatus === 'APPROVED' ? null : photo.moderationReason,
      canAppeal: photo.moderationStatus === 'REJECTED' && photo.appealRequestedAt === null,
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
   * Checks the declared type, then what the bytes really are, then size and
   * dimensions, and re-encodes to JPEG. Re-encoding drops EXIF (including GPS
   * position) and anything else hidden in the original file.
   */
  private async process(input: UploadedImage): Promise<ProcessedImage> {
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
      if (Math.min(width, height) < MIN_EDGE) {
        throw new BadRequestException(`Photos must be at least ${MIN_EDGE} pixels on each side.`);
      }
      if (Math.max(width, height) > MAX_INPUT_EDGE) {
        throw new BadRequestException(
          `Photos can be at most ${MAX_INPUT_EDGE} pixels on each side.`,
        );
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

  async upload(userId: string, input: UploadedImage): Promise<Photo> {
    const image = await this.process(input);
    const live = await this.prisma.userPhoto.findMany({
      where: { userId, deletedAt: null },
      select: { position: true, contentHash: true },
    });
    if (live.length >= MAX_PHOTOS) {
      throw new ConflictException(`You can have up to ${MAX_PHOTOS} photos. Remove one first.`);
    }
    if (live.some((photo) => photo.contentHash === image.contentHash)) {
      throw new ConflictException('You have already added this photo.');
    }

    const id = crypto.randomUUID();
    const storageKey = `photos/${userId}/${id}.jpg`;
    await this.storage.put(storageKey, image.data, 'image/jpeg');
    let photo: UserPhoto;
    try {
      photo = await this.prisma.userPhoto.create({
        data: {
          id,
          userId,
          storageKey,
          position: Math.max(-1, ...live.map((p) => p.position)) + 1,
          width: image.info.width,
          height: image.info.height,
          mimeType: 'image/jpeg',
          sizeBytes: image.data.byteLength,
          contentHash: image.contentHash,
          moderationStatus: 'PENDING',
        },
      });
    } catch (error) {
      await this.storage.delete(storageKey);
      throw error;
    }
    await this.moderation.submit(photo.id, userId);
    return this.toDto(photo);
  }

  /**
   * Swaps the image in a slot for a new one. The new image gets a new storage
   * key (so URLs of the old one die) and goes through moderation from scratch.
   */
  async replace(userId: string, photoId: string, input: UploadedImage): Promise<Photo> {
    const existing = await this.prisma.userPhoto.findFirst({
      where: { id: photoId, userId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Photo not found.');
    const image = await this.process(input);
    const duplicate = await this.prisma.userPhoto.count({
      where: { userId, deletedAt: null, contentHash: image.contentHash, id: { not: photoId } },
    });
    if (duplicate > 0 || existing.contentHash === image.contentHash) {
      throw new ConflictException('You have already added this photo.');
    }
    const storageKey = `photos/${userId}/${crypto.randomUUID()}.jpg`;
    await this.storage.put(storageKey, image.data, 'image/jpeg');
    const photo = await this.prisma.userPhoto.update({
      where: { id: photoId },
      data: {
        storageKey,
        width: image.info.width,
        height: image.info.height,
        sizeBytes: image.data.byteLength,
        contentHash: image.contentHash,
        moderationStatus: 'PENDING',
        moderationReason: null,
        moderatedAt: null,
        appealRequestedAt: null,
      },
    });
    await this.storage.delete(existing.storageKey);
    await this.moderation.submit(photo.id, userId);
    return this.toDto(photo);
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
    await this.moderation.event(userId, userId, 'PHOTO_REMOVED', photo.id, 'removed_by_owner');
  }

  /** Removes every photo and file for an account that is being deleted. */
  async purge(userId: string): Promise<void> {
    const photos = await this.prisma.userPhoto.findMany({ where: { userId } });
    await this.prisma.userPhoto.deleteMany({ where: { userId } });
    await Promise.all(photos.map((photo) => this.storage.delete(photo.storageKey)));
  }
}
