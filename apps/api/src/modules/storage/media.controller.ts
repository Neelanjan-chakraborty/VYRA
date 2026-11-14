import { Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/auth.decorators.js';
import { MediaUrlService } from './media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from './storage.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Serves stored photos to holders of a valid signed URL. With the local
 * storage driver this stands in for object-storage pre-signed URLs.
 */
@ApiExcludeController()
@Controller('media')
export class MediaController {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly urls: MediaUrlService,
  ) {}

  @Public()
  @Get('photos/:ownerId/:file')
  async photo(
    @Param('ownerId') ownerId: string,
    @Param('file') file: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const [id, extension, ...rest] = file.split('.');
    const wellFormed =
      UUID.test(ownerId) && id && UUID.test(id) && extension === 'jpg' && rest.length === 0;
    const key = `photos/${ownerId}/${file}`;
    // One indistinguishable answer for bad signature, expiry and missing object.
    const data =
      wellFormed && this.urls.isValid(key, exp, sig) ? await this.storage.get(key) : null;
    if (!data) throw new NotFoundException('Not found');

    response.setHeader('content-type', 'image/jpeg');
    response.setHeader('cache-control', 'private, max-age=300');
    // The app is served from a different origin than the API.
    response.setHeader('cross-origin-resource-policy', 'cross-origin');
    response.end(data);
  }
}
