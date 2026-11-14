import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  deleteAccountSchema,
  discoveryPreferencesSchema,
  interestsUpdateSchema,
  MAX_PHOTO_BYTES,
  photoOrderSchema,
  profileUpdateSchema,
  relationshipIntentsUpdateSchema,
  type DiscoveryPreferences,
  type Interest,
  type InterestsUpdate,
  type Me,
  type Photo,
  type PhotoOrder,
} from '@vyra/validation';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestId } from '../../common/request-id.middleware.js';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';
import { MeService } from './me.service.js';
import { PhotosService } from './photos.service.js';

const uuidParam = z.uuid();

@ApiTags('me')
@ApiBearerAuth()
@Controller()
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly photos: PhotosService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'The signed-in account, profile, photos and preferences' })
  get(@CurrentUser() user: AuthContext): Promise<Me> {
    return this.me.get(user.userId);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Create or update the profile' })
  updateProfile(
    @CurrentUser() user: AuthContext,
    @Body({ schema: profileUpdateSchema }) body: z.output<typeof profileUpdateSchema>,
  ): Promise<Me> {
    return this.me.updateProfile(user.userId, user.status, body);
  }

  @Put('me/relationship-intents')
  @ApiOperation({ summary: 'Replace relationship intentions' })
  setIntents(
    @CurrentUser() user: AuthContext,
    @Body({ schema: relationshipIntentsUpdateSchema })
    body: z.output<typeof relationshipIntentsUpdateSchema>,
  ): Promise<Me> {
    return this.me.setRelationshipIntents(user.userId, body);
  }

  @Put('me/discovery-preferences')
  @ApiOperation({ summary: 'Replace discovery preferences' })
  setPreferences(
    @CurrentUser() user: AuthContext,
    @Body({ schema: discoveryPreferencesSchema }) body: DiscoveryPreferences,
  ): Promise<Me> {
    return this.me.setDiscoveryPreferences(user.userId, body);
  }

  @Get('interests')
  @ApiOperation({ summary: 'The interest catalogue' })
  async interests(): Promise<{ interests: Interest[] }> {
    return { interests: await this.me.listInterests() };
  }

  @Put('me/interests')
  @ApiOperation({ summary: 'Replace selected interests' })
  setInterests(
    @CurrentUser() user: AuthContext,
    @Body({ schema: interestsUpdateSchema }) body: InterestsUpdate,
  ): Promise<Me> {
    return this.me.setInterests(user.userId, body.interestIds);
  }

  @Post('me/onboarding/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Finish onboarding and become discoverable' })
  completeOnboarding(@CurrentUser() user: AuthContext): Promise<Me> {
    return this.me.completeOnboarding(user.userId);
  }

  @Post('me/photos')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a photo (JPEG, PNG or WebP, up to 10 MB)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  uploadPhoto(
    @CurrentUser() user: AuthContext,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<Photo> {
    if (!file) throw new BadRequestException('Attach a photo in the "file" field.');
    return this.photos.upload(user.userId, file.buffer);
  }

  @Put('me/photos/order')
  @ApiOperation({ summary: 'Reorder photos' })
  async reorderPhotos(
    @CurrentUser() user: AuthContext,
    @Body({ schema: photoOrderSchema }) body: PhotoOrder,
  ): Promise<{ photos: Photo[] }> {
    return { photos: await this.photos.reorder(user.userId, body.photoIds) };
  }

  @Delete('me/photos/:photoId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a photo' })
  async removePhoto(
    @CurrentUser() user: AuthContext,
    @Param('photoId', { schema: uuidParam }) photoId: string,
  ): Promise<void> {
    await this.photos.remove(user.userId, photoId);
  }

  @Delete('me')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete the account and its personal data' })
  async deleteAccount(
    @CurrentUser() user: AuthContext,
    @Body({ schema: deleteAccountSchema }) _body: z.infer<typeof deleteAccountSchema>,
    @Req() request: Request,
  ): Promise<void> {
    await this.me.deleteAccount(user.userId, getRequestId(request));
  }
}
