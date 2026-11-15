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
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type ConversationList,
  type ConversationSettings,
  conversationSettingsUpdateSchema,
  type ConversationSummary,
  markReadSchema,
  MESSAGE_PHOTO_MAX_BYTES,
  mediaMessageSchema,
  type MessagePage,
  MESSAGES_PAGE_SIZE,
  type MessageView,
  pushDeviceSchema,
  sendMessageSchema,
  wingmanRequestSchema,
  type WingmanSuggestions,
} from '@vyra/validation';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestId } from '../../common/request-id.middleware.js';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';
import { MessageMediaService } from './message-media.service.js';
import { MessagingService } from './messaging.service.js';
import { WingmanService } from './wingman.service.js';
import { NotificationService } from './notification.service.js';

const id = z.uuid();
const pageQuery = z.object({
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MESSAGES_PAGE_SIZE).default(MESSAGES_PAGE_SIZE),
});
const planAction = z.enum(['accept', 'decline', 'withdraw']);

@ApiTags('messaging')
@ApiBearerAuth()
@Controller()
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationService,
    private readonly mediaMessages: MessageMediaService,
    private readonly wingman: WingmanService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Conversations with mutual connections, most recent first' })
  list(@CurrentUser() user: AuthContext): Promise<ConversationList> {
    return this.messaging.list(user.userId);
  }

  @Get('conversations/:id')
  summary(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
  ): Promise<ConversationSummary> {
    return this.messaging.summary(user.userId, conversationId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Messages, newest first. Pass nextBefore as before for older ones' })
  messages(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
    @Query({ schema: pageQuery }) query: z.infer<typeof pageQuery>,
  ): Promise<MessagePage> {
    return this.messaging.messages(user.userId, conversationId, query.before, query.limit);
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send text or a date idea. Idempotent on clientId' })
  send(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
    @Body({ schema: sendMessageSchema }) body: z.output<typeof sendMessageSchema>,
  ): Promise<MessageView> {
    return this.messaging.send(user.userId, conversationId, body);
  }

  @Post('conversations/:id/media')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Send a photo (checked before the other person sees it) or a voice note (≤ 60 s)',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MESSAGE_PHOTO_MAX_BYTES, files: 1 } }),
  )
  sendMedia(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
    @Body({ schema: mediaMessageSchema }) body: z.output<typeof mediaMessageSchema>,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MessageView> {
    if (!file) throw new BadRequestException('Attach the file in the "file" field.');
    return body.kind === 'image'
      ? this.mediaMessages.sendPhoto(user.userId, conversationId, body.clientId, file)
      : this.mediaMessages.sendVoice(
          user.userId,
          conversationId,
          body.clientId,
          file,
          body.durationMs,
        );
  }

  @Post('conversations/:id/read')
  @HttpCode(204)
  async read(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
    @Body({ schema: markReadSchema }) body: z.output<typeof markReadSchema>,
  ): Promise<void> {
    await this.messaging.markRead(user.userId, conversationId, body.upTo);
  }

  @Patch('conversations/:id/settings')
  settings(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
    @Body({ schema: conversationSettingsUpdateSchema })
    body: z.output<typeof conversationSettingsUpdateSchema>,
  ): Promise<ConversationSettings> {
    return this.messaging.updateSettings(user.userId, conversationId, body);
  }

  @Post('conversations/:id/wingman')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Wingman: up to three message ideas to edit. Never sends anything' })
  suggest(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
    @Body({ schema: wingmanRequestSchema }) body: z.output<typeof wingmanRequestSchema>,
    @Req() request: Request,
  ): Promise<WingmanSuggestions> {
    return this.wingman.suggest(user.userId, conversationId, body.purpose, getRequestId(request));
  }

  @Delete('messages/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove your own message for both people' })
  async remove(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
  ): Promise<void> {
    await this.messaging.remove(user.userId, messageId);
  }

  @Post('messages/:id/plan/:action')
  @ApiOperation({ summary: 'Accept or decline a date idea, or withdraw your own' })
  plan(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
    @Param('action', { schema: planAction }) action: z.infer<typeof planAction>,
  ): Promise<MessageView> {
    return this.messaging.respondToPlan(user.userId, messageId, action);
  }

  @Put('me/push-devices')
  @HttpCode(204)
  @ApiOperation({ summary: 'Register this device for push notifications' })
  async registerDevice(
    @CurrentUser() user: AuthContext,
    @Body({ schema: pushDeviceSchema }) body: z.output<typeof pushDeviceSchema>,
  ): Promise<void> {
    await this.notifications.registerDevice(user.userId, body.token, body.platform);
  }

  @Delete('me/push-devices')
  @HttpCode(204)
  async forgetDevice(
    @CurrentUser() user: AuthContext,
    @Body({ schema: pushDeviceSchema.pick({ token: true }) }) body: { token: string },
  ): Promise<void> {
    await this.notifications.forgetDevice(user.userId, body.token);
  }
}
