import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  moderationDecisionSchema,
  type ModerationDecision,
  type ModerationQueueItem,
} from '@vyra/validation';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestId } from '../../common/request-id.middleware.js';
import { type AuthContext, CurrentUser, Roles } from '../auth/auth.decorators.js';
import { ModerationService } from './moderation.service.js';

@ApiTags('moderation')
@ApiBearerAuth()
@Roles('MODERATOR', 'ADMIN')
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('photos')
  @ApiOperation({ summary: 'Photos waiting for a person: inconclusive, appealed or reported' })
  async queue(): Promise<{ items: ModerationQueueItem[] }> {
    return { items: await this.moderation.queueForReview() };
  }

  @Post('photos/:photoId/decision')
  @HttpCode(204)
  @ApiOperation({ summary: 'Approve or reject a photo' })
  async decide(
    @CurrentUser() user: AuthContext,
    @Param('photoId', { schema: z.uuid() }) photoId: string,
    @Body({ schema: moderationDecisionSchema }) body: ModerationDecision,
    @Req() request: Request,
  ): Promise<void> {
    await this.moderation.decide(
      user.userId,
      photoId,
      body.decision,
      body.reason,
      getRequestId(request),
    );
  }
}
