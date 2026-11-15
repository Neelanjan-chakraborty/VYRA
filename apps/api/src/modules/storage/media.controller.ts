import { Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { Public } from '../auth/auth.decorators.js';
import { MediaUrlService } from './media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from './storage.js';

/** Extensions the server writes for message media → content type. */
const MESSAGE_MEDIA_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  m4a: 'audio/mp4',
  webm: 'audio/webm',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
    const [id, extension, ...rest] = file.split('.');
    const wellFormed =
      UUID.test(ownerId) && id && UUID.test(id) && extension === 'jpg' && rest.length === 0;
    const key = `photos/${ownerId}/${file}`;
    // One indistinguishable answer for every refusal.
    const scope = wellFormed ? this.urls.verify(key, scopeCode, exp, sig) : null;
    // Conversation URLs are only ever issued for message media.
    if (!scope || scope === 'conversation') throw new NotFoundException('Not found');

    const photo = await this.prisma.userPhoto.findUnique({
      where: { storageKey: key },
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
    if (!data) throw new NotFoundException('Not found');

    response.setHeader('content-type', 'image/jpeg');
    // Short cache so a moderation decision takes effect quickly in browsers too.
    response.setHeader(
      'cache-control',
      scope === 'public' ? 'private, max-age=60' : 'private, no-store',
    );
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
    const [id, extension, ...rest] = file.split('.');
    const contentType = extension ? MESSAGE_MEDIA_TYPES[extension] : undefined;
    const wellFormed =
      UUID.test(conversationId) && id && UUID.test(id) && contentType && rest.length === 0;
    const key = `messages/${conversationId}/${file}`;
    const scope = wellFormed ? this.urls.verify(key, scopeCode, exp, sig) : null;
    if (scope !== 'owner' && scope !== 'conversation') throw new NotFoundException('Not found');

    const message = await this.prisma.message.findFirst({
      where: { mediaKey: key, conversationId, deletedAt: null },
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
    response.setHeader('cache-control', 'private, no-store');
    response.setHeader('cross-origin-resource-policy', 'cross-origin');
    response.end(data);
  }
}
