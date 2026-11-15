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
import {
  IMAGE_FORMAT,
  type ProcessedImage,
  processImage,
  type UploadedImage,
} from '../../common/image.js';
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
      thumbUrl: photo.thumbKey ? this.urls.sign(photo.thumbKey, 'owner') : null,
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
    const { storageKey, thumbKey } = await this.store(userId, id, image);
    let photo: UserPhoto;
    try {
      photo = await this.prisma.userPhoto.create({
        data: {
          id,
          userId,
          storageKey,
          thumbKey,
          position: Math.max(-1, ...live.map((p) => p.position)) + 1,
          width: image.info.width,
          height: image.info.height,
          mimeType: IMAGE_FORMAT.contentType,
          sizeBytes: image.data.byteLength,
          contentHash: image.contentHash,
          moderationStatus: 'PENDING',
        },
      });
    } catch (error) {
      await this.deleteFiles({ storageKey, thumbKey });
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
    const { storageKey, thumbKey } = await this.store(userId, crypto.randomUUID(), image);
    const photo = await this.prisma.userPhoto.update({
      where: { id: photoId },
      data: {
        storageKey,
        thumbKey,
        mimeType: IMAGE_FORMAT.contentType,
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
    await this.deleteFiles(existing);
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
    await this.deleteFiles(photo);
    await this.moderation.event(userId, userId, 'PHOTO_REMOVED', photo.id, 'removed_by_owner');
  }

  /** Removes every photo and file for an account that is being deleted. */
  /** Account deletion: profile photos and every file in the person's private vault. */
  async purge(userId: string): Promise<void> {
    const photos = await this.prisma.userPhoto.findMany({ where: { userId } });
    await this.prisma.userPhoto.deleteMany({ where: { userId } });
    await Promise.all(photos.map((photo) => this.deleteFiles(photo)));
    const vault = await this.prisma.mediaVaultItem.findMany({ where: { ownerId: userId } });
    await this.prisma.mediaVaultItem.deleteMany({ where: { ownerId: userId } });
    await Promise.all(
      vault.map((item) =>
        this.deleteFiles({ storageKey: item.storageKey, thumbKey: item.thumbKey }),
      ),
    );
  }

  /** Writes the full image and its thumbnail under fresh keys. */
  private async store(
    userId: string,
    id: string,
    image: ProcessedImage,
  ): Promise<{ storageKey: string; thumbKey: string }> {
    const storageKey = `photos/${userId}/${id}.${IMAGE_FORMAT.extension}`;
    const thumbKey = `photos/${userId}/${id}.thumb.${IMAGE_FORMAT.extension}`;
    await Promise.all([
      this.storage.put(storageKey, image.data, IMAGE_FORMAT.contentType),
      this.storage.put(thumbKey, image.thumb, IMAGE_FORMAT.contentType),
    ]);
    return { storageKey, thumbKey };
  }

  private async deleteFiles(photo: { storageKey: string; thumbKey: string | null }): Promise<void> {
    await Promise.all([
      this.storage.delete(photo.storageKey),
      ...(photo.thumbKey ? [this.storage.delete(photo.thumbKey)] : []),
    ]);
  }
}
