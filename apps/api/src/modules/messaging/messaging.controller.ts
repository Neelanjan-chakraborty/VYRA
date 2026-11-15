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
  editMessageSchema,
  forwardMessageSchema,
  type PinnedList,
  reactionInputSchema,
  scheduleMessageSchema,
  type ScheduledList,
  type ScheduledMessageView,
  type VaultItem,
  type VaultList,
  VIDEO_MAX_BYTES,
  type ConversationSummary,
  markReadSchema,
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
import { EphemeralService } from './ephemeral.service.js';
import { MessageActionsService } from './message-actions.service.js';
import { MessageMediaService } from './message-media.service.js';
import { MessagingService } from './messaging.service.js';
import { VaultService } from './vault.service.js';
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
    private readonly actions: MessageActionsService,
    private readonly ephemeral: EphemeralService,
    private readonly vault: VaultService,
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
    summary:
      'Send a photo or video (checked before the other person sees it) or a voice note. Optional view once, timer, sensitive, allowSave',
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: VIDEO_MAX_BYTES, files: 1 } }))
  sendMedia(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
    @Body({ schema: mediaMessageSchema }) body: z.output<typeof mediaMessageSchema>,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MessageView> {
    if (!file) throw new BadRequestException('Attach the file in the "file" field.');
    switch (body.kind) {
      case 'image':
        return this.mediaMessages.sendPhoto(user.userId, conversationId, body.clientId, file, body);
      case 'video':
        return this.mediaMessages.sendVideo(user.userId, conversationId, body.clientId, file, body);
      case 'voice':
        return this.mediaMessages.sendVoice(
          user.userId,
          conversationId,
          body.clientId,
          file,
          body.durationMs,
          body,
        );
    }
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

  @Put('messages/:id/reaction')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'React to a message (one reaction per person; replaces yours)' })
  react(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
    @Body({ schema: reactionInputSchema }) body: z.output<typeof reactionInputSchema>,
  ): Promise<MessageView> {
    return this.actions.react(user.userId, messageId, body.emoji);
  }

  @Delete('messages/:id/reaction')
  unreact(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
  ): Promise<MessageView> {
    return this.actions.unreact(user.userId, messageId);
  }

  @Post('messages/:id/pin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pin a message for both people (up to three)' })
  pin(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
  ): Promise<MessageView> {
    return this.actions.pin(user.userId, messageId);
  }

  @Delete('messages/:id/pin')
  unpin(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
  ): Promise<MessageView> {
    return this.actions.unpin(user.userId, messageId);
  }

  @Get('conversations/:id/pinned')
  pinned(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
  ): Promise<PinnedList> {
    return this.actions.pinned(user.userId, conversationId);
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Edit your own text within 15 minutes of sending' })
  edit(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
    @Body({ schema: editMessageSchema }) body: z.output<typeof editMessageSchema>,
  ): Promise<MessageView> {
    return this.actions.edit(user.userId, messageId, body.body);
  }

  @Post('messages/:id/forward')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Forward your own text to your other conversations. Media never' })
  forward(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
    @Body({ schema: forwardMessageSchema }) body: z.output<typeof forwardMessageSchema>,
  ): Promise<{ forwarded: number }> {
    return this.actions.forward(user.userId, messageId, body.conversationIds);
  }

  @Post('conversations/:id/scheduled')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Schedule a text message up to seven days ahead' })
  schedule(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
    @Body({ schema: scheduleMessageSchema }) body: z.output<typeof scheduleMessageSchema>,
  ): Promise<ScheduledMessageView> {
    return this.actions.schedule(user.userId, conversationId, body.body, body.sendAt);
  }

  @Get('conversations/:id/scheduled')
  scheduled(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) conversationId: string,
  ): Promise<ScheduledList> {
    return this.actions.scheduled(user.userId, conversationId);
  }

  @Delete('scheduled/:id')
  @HttpCode(204)
  async cancelScheduled(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) scheduledId: string,
  ): Promise<void> {
    await this.actions.cancel(user.userId, scheduledId);
  }

  @Post('messages/:id/open')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Open view-once or timed media: returns one-minute URLs. View once works once',
  })
  open(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
  ): Promise<MessageView> {
    return this.ephemeral.open(user.userId, messageId);
  }

  @Post('messages/:id/close')
  @HttpCode(204)
  @ApiOperation({ summary: 'Closed a view-once item: it is erased now' })
  async close(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
  ): Promise<void> {
    await this.ephemeral.close(user.userId, messageId);
  }

  @Post('messages/:id/save')
  @ApiOperation({ summary: 'Keep a photo or video in your private vault (if allowed)' })
  save(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) messageId: string,
  ): Promise<VaultItem> {
    return this.vault.save(user.userId, messageId);
  }

  @Get('me/vault')
  vaultList(@CurrentUser() user: AuthContext): Promise<VaultList> {
    return this.vault.list(user.userId);
  }

  @Delete('me/vault/:id')
  @HttpCode(204)
  async vaultRemove(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) itemId: string,
  ): Promise<void> {
    await this.vault.remove(user.userId, itemId);
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
