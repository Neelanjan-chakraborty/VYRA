import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MAX_PHOTOS, type Photo } from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import type { UserPhoto } from '../../generated/prisma/client.js';
import { type ProcessedImage, processImage, type UploadedImage } from '../../common/image.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { MediaUrlService } from '../storage/media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.js';

const MIN_EDGE = 400;
/** Offset used to move photos out of the way while reordering. */
const REORDER_OFFSET = 1000;

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

  private process(input: UploadedImage): Promise<ProcessedImage> {
    return processImage(input, MIN_EDGE);
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
