import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  type OnModuleInit,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { type MessageView, VOICE_MAX_BYTES, VOICE_MAX_MS } from '@vyra/validation';
import { sniffAudio } from '../../common/audio.js';
import { processImage, type UploadedImage } from '../../common/image.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Message, Prisma } from '../../generated/prisma/client.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.js';
import { type ConversationAccess, MessagingService } from './messaging.service.js';

/** Message photos can be smaller than profile photos. */
const MESSAGE_PHOTO_MIN_EDGE = 200;
const VOICE_TYPES = {
  mp4: { ext: 'm4a', type: 'audio/mp4' },
  webm: { ext: 'webm', type: 'audio/webm' },
};

/**
 * Photos and voice notes in conversations. Photos go through the same checks
 * and classifier as profile photos; the other person sees nothing until a
 * photo is approved. Voice notes have no automated check (there is no
 * open-source audio classifier in use): they are limited in length and size,
 * and can be reported, which hides them from the reporter at once.
 */
@Injectable()
export class MessageMediaService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly moderation: ModerationService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  onModuleInit(): void {
    this.moderation.onMessageAssessed((messageId) => this.assessed(messageId));
  }

  private async assessed(messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message?.senderId) return;
    try {
      const access = await this.messaging.access(message.senderId, message.conversationId);
      this.messaging.changed(access, message.senderId, 'media');
      if (message.mediaStatus === 'APPROVED')
        await this.messaging.notifyNewMessage(access, message.senderId);
    } catch {
      // The conversation is no longer visible (block, deletion): nothing to tell.
    }
  }

  /** A retried upload with the same clientId returns the first message. */
  private async existing(access: ConversationAccess, userId: string, clientId: string) {
    const found = await this.prisma.message.findUnique({
      where: { conversationId_clientId: { conversationId: access.conversationId, clientId } },
    });
    return found?.senderId === userId ? this.messaging.view(found, access, userId) : null;
  }

  private async save(
    access: ConversationAccess,
    userId: string,
    data: Omit<Prisma.MessageUncheckedCreateInput, 'conversationId' | 'senderId'>,
  ): Promise<Message> {
    const message = await this.messaging.store({
      ...data,
      conversationId: access.conversationId,
      senderId: userId,
    });
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: access.conversationId, userId } },
      data: { lastReadAt: message.createdAt },
    });
    this.messaging.changed(access, userId, 'message');
    return message;
  }

  async sendPhoto(
    userId: string,
    conversationId: string,
    clientId: string,
    file: UploadedImage,
  ): Promise<MessageView> {
    const access = await this.messaging.writable(userId, conversationId);
    const repeat = await this.existing(access, userId, clientId);
    if (repeat) return repeat;
    const image = await processImage(file, MESSAGE_PHOTO_MIN_EDGE);
    const id = randomUUID();
    const mediaKey = `messages/${conversationId}/${id}.jpg`;
    await this.storage.put(mediaKey, image.data, 'image/jpeg');
    const message = await this.save(access, userId, {
      id,
      clientId,
      kind: 'IMAGE',
      mediaKey,
      mediaStatus: 'PENDING',
      mediaWidth: image.info.width,
      mediaHeight: image.info.height,
    });
    await this.moderation.submitMessage(message.id);
    return this.messaging.view(message, access, userId);
  }

  async sendVoice(
    userId: string,
    conversationId: string,
    clientId: string,
    file: { buffer: Buffer; size: number },
    declaredMs: number,
  ): Promise<MessageView> {
    const access = await this.messaging.writable(userId, conversationId);
    const repeat = await this.existing(access, userId, clientId);
    if (repeat) return repeat;
    if (file.size > VOICE_MAX_BYTES)
      throw new BadRequestException('Voice notes can be up to 2 MB.');
    const audio = sniffAudio(file.buffer);
    if (!audio) throw new UnsupportedMediaTypeException('Send an M4A or WebM voice note.');
    // Trust the file's own duration when it has one; otherwise the size limit bounds it.
    const durationMs = audio.durationMs ?? declaredMs;
    if (durationMs < 1 || durationMs > VOICE_MAX_MS + 500)
      throw new BadRequestException('Voice notes can be up to a minute long.');
    const id = randomUUID();
    const { ext, type } = VOICE_TYPES[audio.container];
    const mediaKey = `messages/${conversationId}/${id}.${ext}`;
    await this.storage.put(mediaKey, file.buffer, type);
    const message = await this.save(access, userId, {
      id,
      clientId,
      kind: 'VOICE',
      mediaKey,
      mediaStatus: 'APPROVED',
      mediaDurationMs: Math.min(VOICE_MAX_MS, Math.max(1, Math.round(durationMs))),
    });
    await this.messaging.notifyNewMessage(access, userId);
    return this.messaging.view(message, access, userId);
  }
}
