import {
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
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
  mp4: 'video/mp4',
};
/** Variants stored beside a media file: `<uuid>.<variant>.<ext>`. */
const VARIANTS = new Set(['thumb', 'preview', 'poster']);

/** `<uuid>.<ext>` or `<uuid>.thumb.<ext>` → its content type, or null if malformed. */
function parseFile(file: string, types: Readonly<Record<string, string>>): string | null {
  const parts = file.split('.');
  const [id] = parts;
  const extension = parts.at(-1);
  const shapeOk = parts.length === 2 || (parts.length === 3 && VARIANTS.has(parts[1] ?? ''));
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
  if (scope === 'moderator' || scope === 'opened') return 'private, no-store';
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
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const contentType = UUID.test(conversationId) ? parseFile(file, MESSAGE_MEDIA_TYPES) : null;
    const wellFormed = contentType !== null;
    const key = `messages/${conversationId}/${file}`;
    const scope = wellFormed ? this.urls.verify(key, scopeCode, exp, sig) : null;
    if (scope !== 'owner' && scope !== 'conversation' && scope !== 'opened')
      throw new NotFoundException('Not found');

    const message = await this.prisma.message.findFirst({
      where: {
        conversationId,
        deletedAt: null,
        OR: [
          { mediaKey: key },
          { mediaThumbKey: key },
          { mediaAltKey: key },
          { mediaPosterKey: key },
          { mediaPreviewKey: key },
        ],
      },
      select: {
        senderId: true,
        mediaStatus: true,
        reportedAt: true,
        viewOnce: true,
        timerSeconds: true,
        openedAt: true,
        expiresAt: true,
        mediaPreviewKey: true,
        conversation: {
          select: { participants: { select: { userId: true, mediaConsent: true } } },
        },
      },
    });
    let servable =
      message !== null && (message.expiresAt === null || message.expiresAt > new Date());
    if (message && servable && scope !== 'owner') {
      const ids = message.conversation.participants.map((p) => p.userId);
      const recipient = message.conversation.participants.find(
        (p) => p.userId !== message.senderId,
      );
      const blocks = await this.prisma.blockedUser.count({
        where: { blockerId: { in: ids }, blockedId: { in: ids } },
      });
      const protectedMedia = message.viewOnce || message.timerSeconds !== null;
      servable =
        message.mediaStatus === 'APPROVED' &&
        message.reportedAt === null &&
        blocks === 0 &&
        // Held until the recipient allows media from the sender.
        recipient?.mediaConsent === 'ALLOWED' &&
        // View-once and timed media: only the blurred preview, until opened.
        (scope === 'opened'
          ? protectedMedia && message.openedAt !== null
          : !protectedMedia || key === message.mediaPreviewKey);
    }
    const data = servable ? await this.storage.get(key) : null;
    if (!data || !contentType) throw new NotFoundException('Not found');
    send(response, data, contentType, cacheControl(scope ?? 'owner'), range);
  }

  /** The owner's private vault. Nobody else is ever issued a URL for it. */
  @Public()
  @Get('vault/:ownerId/:file')
  async vault(
    @Param('ownerId') ownerId: string,
    @Param('file') file: string,
    @Query('s') scopeCode: string | undefined,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const contentType = UUID.test(ownerId) ? parseFile(file, MESSAGE_MEDIA_TYPES) : null;
    const key = `vault/${ownerId}/${file}`;
    const scope = contentType ? this.urls.verify(key, scopeCode, exp, sig) : null;
    if (scope !== 'owner') throw new NotFoundException('Not found');
    const item = await this.prisma.mediaVaultItem.findFirst({
      where: { ownerId, OR: [{ storageKey: key }, { thumbKey: key }] },
      select: { id: true },
    });
    const data = item ? await this.storage.get(key) : null;
    if (!data || !contentType) throw new NotFoundException('Not found');
    send(response, data, contentType, cacheControl(scope), range);
  }
}

/**
 * Writes the file, honouring a single byte range (video players seek and
 * stream with these). The app is served from a different origin than the API.
 */
function send(
  response: Response,
  data: Buffer,
  contentType: string,
  cache: string,
  range: string | undefined,
): void {
  response.setHeader('content-type', contentType);
  response.setHeader('cache-control', cache);
  response.setHeader('cross-origin-resource-policy', 'cross-origin');
  response.setHeader('accept-ranges', 'bytes');
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (!match || (!match[1] && !match[2])) {
    response.end(data);
    return;
  }
  const size = data.byteLength;
  let start = match[1] ? Number(match[1]) : size - Number(match[2]);
  let end = match[1] && match[2] ? Number(match[2]) : size - 1;
  start = Math.max(0, start);
  end = Math.min(end, size - 1);
  if (start > end || start >= size) {
    response.status(416).setHeader('content-range', `bytes */${size}`);
    response.end();
    return;
  }
  response.status(206).setHeader('content-range', `bytes ${start}-${end}/${size}`);
  response.end(data.subarray(start, end + 1));
}
