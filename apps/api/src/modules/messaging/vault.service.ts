import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { VaultItem, VaultList } from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import type { MediaVaultItem } from '../../generated/prisma/client.js';
import { MediaUrlService } from '../storage/media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.js';
import { MessagingService } from './messaging.service.js';

const NOT_FOUND = 'Not found.';
const KIND = { IMAGE: 'image', VIDEO: 'video', VOICE: 'voice' } as const;

/**
 * A person's private copies of photos and videos: their own, or ones the
 * sender let them keep. Never view-once or timed media. Copies are separate
 * files under the owner's own prefix, so they outlive the conversation and are
 * removed with the account. Only the owner can see them.
 */
@Injectable()
export class VaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly urls: MediaUrlService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private view(item: MediaVaultItem): VaultItem {
    return {
      id: item.id,
      kind: KIND[item.kind as keyof typeof KIND],
      url: this.urls.sign(item.storageKey, 'owner'),
      thumbUrl: item.thumbKey ? this.urls.sign(item.thumbKey, 'owner') : null,
      width: item.width,
      height: item.height,
      durationMs: item.durationMs,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async save(userId: string, messageId: string): Promise<VaultItem> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt || this.messaging.expired(message))
      throw new NotFoundException(NOT_FOUND);
    const access = await this.messaging.access(userId, message.conversationId);
    const mine = message.senderId === userId;
    if (!mine && (message.reportedAt || access.me.mediaConsent === 'ASK'))
      throw new NotFoundException(NOT_FOUND);
    if (
      (message.kind !== 'IMAGE' && message.kind !== 'VIDEO') ||
      !message.mediaKey ||
      message.mediaStatus !== 'APPROVED'
    )
      throw new UnprocessableEntityException('Only photos and videos can be saved.');
    const ephemeral = message.viewOnce || message.timerSeconds !== null;
    if (!mine && (ephemeral || !message.allowSave))
      throw new ConflictException('The sender didn’t allow saving this.');

    const existing = await this.prisma.mediaVaultItem.findUnique({
      where: { ownerId_sourceMessageId: { ownerId: userId, sourceMessageId: messageId } },
    });
    if (existing) return this.view(existing);

    const id = randomUUID();
    const sourceThumb = message.kind === 'IMAGE' ? message.mediaThumbKey : message.mediaPosterKey;
    const [data, thumb] = await Promise.all([
      this.storage.get(message.mediaKey),
      sourceThumb ? this.storage.get(sourceThumb) : Promise.resolve(null),
    ]);
    if (!data) throw new NotFoundException(NOT_FOUND);
    const extension = message.mediaKey.split('.').at(-1) ?? 'bin';
    const storageKey = `vault/${userId}/${id}.${extension}`;
    const thumbKey = thumb ? `vault/${userId}/${id}.thumb.avif` : null;
    await Promise.all([
      this.storage.put(storageKey, data, extension === 'mp4' ? 'video/mp4' : 'image/avif'),
      ...(thumb && thumbKey ? [this.storage.put(thumbKey, thumb, 'image/avif')] : []),
    ]);
    const item = await this.prisma.mediaVaultItem.create({
      data: {
        id,
        ownerId: userId,
        kind: message.kind,
        storageKey,
        thumbKey,
        bytes: data.byteLength,
        width: message.mediaWidth,
        height: message.mediaHeight,
        durationMs: message.mediaDurationMs,
        sourceMessageId: messageId,
      },
    });
    return this.view(item);
  }

  async list(userId: string): Promise<VaultList> {
    const items = await this.prisma.mediaVaultItem.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return { items: items.map((item) => this.view(item)) };
  }

  async remove(userId: string, itemId: string): Promise<void> {
    const item = await this.prisma.mediaVaultItem.findFirst({
      where: { id: itemId, ownerId: userId },
    });
    if (!item) throw new NotFoundException(NOT_FOUND);
    await this.prisma.mediaVaultItem.delete({ where: { id: item.id } });
    for (const key of [item.storageKey, item.thumbKey])
      if (key) await this.storage.delete(key).catch(() => undefined);
  }
}
