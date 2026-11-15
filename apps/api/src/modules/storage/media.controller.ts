import { Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { Public } from '../auth/auth.decorators.js';
import { type MediaScope, MediaUrlService } from './media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from './storage.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Extensions the server writes → content type. jpg, m4a and webm are older uploads. */
const PHOTO_TYPES: Readonly<Record<string, string>> = {
  avif: 'image/avif',
  jpg: 'image/jpeg',
};
const MESSAGE_MEDIA_TYPES: Readonly<Record<string, string>> = {
  ...PHOTO_TYPES,
  ogg: 'audio/ogg',
  caf: 'audio/x-caf',
  m4a: 'audio/mp4',
  webm: 'audio/webm',
};

/** `<uuid>.<ext>` or `<uuid>.thumb.<ext>` → its content type, or null if malformed. */
function parseFile(file: string, types: Readonly<Record<string, string>>): string | null {
  const parts = file.split('.');
  const [id] = parts;
  const extension = parts.at(-1);
  const shapeOk = parts.length === 2 || (parts.length === 3 && parts[1] === 'thumb');
  if (!id || !UUID.test(id) || !shapeOk || !extension) return null;
  return types[extension] ?? null;
}

/**
 * Signed URLs are immutable for their ten-minute life. The owner's own media
 * may be cached for all of it; what other people see is cached for a minute
 * at most, so moderation, blocks and reports reach their devices quickly.
 */
function cacheControl(scope: MediaScope): string {
  if (scope === 'owner') return 'private, max-age=600, immutable';
  if (scope === 'moderator') return 'private, no-store';
  return 'private, max-age=60';
}

/**
 * Serves stored photos to holders of a valid signed URL. The database is
 * checked on every request, so a photo that is rejected, hidden or deleted
 * stops being served at once, even through URLs issued earlier.
 */
@ApiExcludeController()
@Controller('media')
export class MediaController {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly urls: MediaUrlService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('photos/:ownerId/:file')
  async photo(
    @Param('ownerId') ownerId: string,
    @Param('file') file: string,
    @Query('s') scopeCode: string | undefined,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const contentType = UUID.test(ownerId) ? parseFile(file, PHOTO_TYPES) : null;
    const wellFormed = contentType !== null;
    const key = `photos/${ownerId}/${file}`;
    // One indistinguishable answer for every refusal.
    const scope = wellFormed ? this.urls.verify(key, scopeCode, exp, sig) : null;
    // Conversation URLs are only ever issued for message media.
    if (!scope || scope === 'conversation') throw new NotFoundException('Not found');

    // The full image or its thumbnail: both follow the photo's own state.
    const photo = await this.prisma.userPhoto.findFirst({
      where: { OR: [{ storageKey: key }, { thumbKey: key }] },
      select: {
        deletedAt: true,
        moderationStatus: true,
        user: {
          select: { status: true, deletedAt: true, profile: { select: { isDiscoverable: true } } },
        },
      },
    });
    const servable =
      photo !== null &&
      photo.deletedAt === null &&
      (scope !== 'public' ||
        (photo.moderationStatus === 'APPROVED' &&
          photo.user.status === 'ACTIVE' &&
          photo.user.deletedAt === null &&
          photo.user.profile?.isDiscoverable === true));
    const data = servable ? await this.storage.get(key) : null;
    if (!data || !contentType) throw new NotFoundException('Not found');

    response.setHeader('content-type', contentType);
    response.setHeader('cache-control', cacheControl(scope));
    // The app is served from a different origin than the API.
    response.setHeader('cross-origin-resource-policy', 'cross-origin');
    response.end(data);
  }

  /**
   * Photos and voice notes sent in a conversation. The sender's own URL works
   * while the message exists; the other person's only while the media is
   * approved, not removed or reported, and neither has blocked the other.
   */
  @Public()
  @Get('messages/:conversationId/:file')
  async message(
    @Param('conversationId') conversationId: string,
    @Param('file') file: string,
    @Query('s') scopeCode: string | undefined,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const contentType = UUID.test(conversationId) ? parseFile(file, MESSAGE_MEDIA_TYPES) : null;
    const wellFormed = contentType !== null;
    const key = `messages/${conversationId}/${file}`;
    const scope = wellFormed ? this.urls.verify(key, scopeCode, exp, sig) : null;
    if (scope !== 'owner' && scope !== 'conversation') throw new NotFoundException('Not found');

    const message = await this.prisma.message.findFirst({
      where: {
        conversationId,
        deletedAt: null,
        OR: [{ mediaKey: key }, { mediaThumbKey: key }, { mediaAltKey: key }],
      },
      select: {
        senderId: true,
        mediaStatus: true,
        reportedAt: true,
        conversation: { select: { participants: { select: { userId: true } } } },
      },
    });
    let servable = message !== null;
    if (message && scope === 'conversation') {
      const ids = message.conversation.participants.map((p) => p.userId);
      const blocks = await this.prisma.blockedUser.count({
        where: { blockerId: { in: ids }, blockedId: { in: ids } },
      });
      servable = message.mediaStatus === 'APPROVED' && message.reportedAt === null && blocks === 0;
    }
    const data = servable ? await this.storage.get(key) : null;
    if (!data || !contentType) throw new NotFoundException('Not found');

    response.setHeader('content-type', contentType);
    response.setHeader('cache-control', cacheControl(scope));
    response.setHeader('cross-origin-resource-policy', 'cross-origin');
    response.end(data);
  }
}
