import { Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { Public } from '../auth/auth.decorators.js';
import { MediaUrlService } from './media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from './storage.js';

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
    if (!scope) throw new NotFoundException('Not found');

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
}
