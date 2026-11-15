import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  MESSAGE_PHOTO_MAX_BYTES,
  type MessageView,
  VIDEO_MAX_BYTES,
  VOICE_MAX_BYTES,
  VOICE_MAX_MS,
} from '@vyra/validation';
import type { Queue } from 'bullmq';
import sharp from 'sharp';
import { sniffAudio } from '../../common/audio.js';
import { type TranscodedVoice, transcodeVoice } from '../../common/audio-transcode.js';
import { AVIF, IMAGE_FORMAT, processImage, type UploadedImage } from '../../common/image.js';
import { sniffVideo, transcodeVideo } from '../../common/video-transcode.js';
import {
  blurredPreview,
  watermarkImage,
  watermarkOverlay,
  watermarkText,
} from '../../common/watermark.js';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Message, Prisma } from '../../generated/prisma/client.js';
import { VIDEO_QUEUE } from '../../queue/queue.module.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.js';
import { type ConversationAccess, MessagingService } from './messaging.service.js';

/** Message photos can be smaller than profile photos. */
const MESSAGE_PHOTO_MIN_EDGE = 200;
/** Video posters: long edge at most this. */
const POSTER_EDGE = 720;

/** What a sender can put on media. A view-once or timed item can never be saved. */
export interface Protection {
  readonly viewOnce: boolean;
  readonly timerSeconds?: number | undefined;
  readonly sensitive: boolean;
  readonly allowSave: boolean;
}

export interface VideoJob {
  readonly messageId: string;
}

const NONE: Protection = { viewOnce: false, sensitive: false, allowSave: true };

/** Protected media carries the recipient's watermark (product decision D-071). */
function isProtected(p: Protection): boolean {
  return p.viewOnce || p.timerSeconds !== undefined || p.sensitive;
}

function protectionFields(p: Protection) {
  const ephemeral = p.viewOnce || p.timerSeconds !== undefined;
  return {
    viewOnce: p.viewOnce,
    timerSeconds: p.viewOnce ? null : (p.timerSeconds ?? null),
    sensitive: p.sensitive,
    allowSave: p.allowSave && !ephemeral,
  };
}

/**
 * Photos, videos and voice notes in conversations. Photos go through the same checks
 * and classifier as profile photos; the other person sees nothing until a
 * photo is approved. Voice notes have no automated check (there is no
 * open-source audio classifier in use): they are limited in length and size,
 * and can be reported, which hides them from the reporter at once.
 */
@Injectable()
export class MessageMediaService implements OnModuleInit {
  private readonly logger = new Logger(MessageMediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly moderation: ModerationService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(ENV) private readonly env: Env,
    @InjectQueue(VIDEO_QUEUE) private readonly videoQueue: Queue<VideoJob>,
  ) {}

  /** "Kabir · 15 Nov" for the person who will receive it. */
  private async watermarkFor(recipientId: string, at = new Date()): Promise<string> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId: recipientId },
      select: { displayName: true },
    });
    return watermarkText(profile?.displayName ?? '', at);
  }

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
    file: UploadedImage & { size: number },
    protection: Protection = NONE,
  ): Promise<MessageView> {
    const access = await this.messaging.writable(userId, conversationId);
    const repeat = await this.existing(access, userId, clientId);
    if (repeat) return repeat;
    if (file.size > MESSAGE_PHOTO_MAX_BYTES)
      throw new BadRequestException('Photos can be up to 10 MB.');
    const image = await processImage(file, MESSAGE_PHOTO_MIN_EDGE);
    let { data, thumb } = image;
    if (isProtected(protection)) {
      const text = await this.watermarkFor(access.otherId);
      [data, thumb] = await Promise.all([watermarkImage(data, text), watermarkImage(thumb, text)]);
    }
    const id = randomUUID();
    const base = `messages/${conversationId}/${id}`;
    const mediaKey = `${base}.${IMAGE_FORMAT.extension}`;
    const mediaThumbKey = `${base}.thumb.${IMAGE_FORMAT.extension}`;
    const mediaPreviewKey = `${base}.preview.${IMAGE_FORMAT.extension}`;
    await Promise.all([
      this.storage.put(mediaKey, data, IMAGE_FORMAT.contentType),
      this.storage.put(mediaThumbKey, thumb, IMAGE_FORMAT.contentType),
      this.storage.put(
        mediaPreviewKey,
        await blurredPreview(image.thumb),
        IMAGE_FORMAT.contentType,
      ),
    ]);
    const message = await this.save(access, userId, {
      id,
      clientId,
      kind: 'IMAGE',
      mediaKey,
      mediaThumbKey,
      mediaPreviewKey,
      mediaBytes: data.byteLength,
      mediaStatus: 'PENDING',
      mediaWidth: image.info.width,
      mediaHeight: image.info.height,
      ...protectionFields(protection),
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
    protection: Protection = NONE,
  ): Promise<MessageView> {
    const access = await this.messaging.writable(userId, conversationId);
    const repeat = await this.existing(access, userId, clientId);
    if (repeat) return repeat;
    if (file.size > VOICE_MAX_BYTES)
      throw new BadRequestException('Voice notes can be up to 2 MB.');
    // Only recordings from the app's recorders are accepted (judged by content).
    if (!sniffAudio(file.buffer))
      throw new UnsupportedMediaTypeException('Send an M4A or WebM voice note.');
    // Re-encode to speech-tuned Opus; the duration comes from the result, not the client.
    let voice: TranscodedVoice;
    try {
      voice = await transcodeVoice(file.buffer, {
        ffmpeg: this.env.FFMPEG_PATH,
        ffprobe: this.env.FFPROBE_PATH,
      });
    } catch (error) {
      this.logger.warn(`Voice note refused (${file.size} bytes): ${(error as Error).message}`);
      throw new BadRequestException('That voice note could not be read.');
    }
    if (voice.durationMs > VOICE_MAX_MS + 500)
      throw new BadRequestException('Voice notes can be up to a minute long.');
    const id = randomUUID();
    const mediaKey = `messages/${conversationId}/${id}.ogg`;
    const mediaAltKey = `messages/${conversationId}/${id}.caf`;
    await Promise.all([
      this.storage.put(mediaKey, voice.ogg, 'audio/ogg'),
      this.storage.put(mediaAltKey, voice.caf, 'audio/x-caf'),
    ]);
    const message = await this.save(access, userId, {
      id,
      clientId,
      kind: 'VOICE',
      mediaKey,
      mediaAltKey,
      mediaBytes: voice.ogg.byteLength,
      mediaStatus: 'APPROVED',
      mediaDurationMs: Math.min(VOICE_MAX_MS, Math.max(1, voice.durationMs || declaredMs)),
      // Voice notes have no timer; view once and sensitive apply.
      ...protectionFields({ ...protection, timerSeconds: undefined }),
    });
    await this.messaging.notifyNewMessage(access, userId);
    return this.messaging.view(message, access, userId);
  }

  /**
   * Accepts a clip (MP4, MOV or WebM, judged by its bytes) and answers at once
   * with a "checking" message; transcoding and the frame-by-frame check happen
   * in the background, and the other person sees nothing until it passes.
   */
  async sendVideo(
    userId: string,
    conversationId: string,
    clientId: string,
    file: { buffer: Buffer; size: number },
    protection: Protection = NONE,
  ): Promise<MessageView> {
    const access = await this.messaging.writable(userId, conversationId);
    const repeat = await this.existing(access, userId, clientId);
    if (repeat) return repeat;
    if (file.size > VIDEO_MAX_BYTES) throw new BadRequestException('Videos can be up to 25 MB.');
    if (!sniffVideo(file.buffer))
      throw new UnsupportedMediaTypeException('Send an MP4, MOV or WebM video.');
    const id = randomUUID();
    await this.storage.put(uploadKey(id), file.buffer, 'application/octet-stream');
    const message = await this.save(access, userId, {
      id,
      clientId,
      kind: 'VIDEO',
      // The waiting upload until processing replaces it; never signed for anyone.
      mediaKey: uploadKey(id),
      mediaStatus: 'PENDING',
      ...protectionFields(protection),
    });
    await this.videoQueue.add(
      'process',
      { messageId: id },
      { jobId: id, removeOnComplete: true, removeOnFail: 100, attempts: 2 },
    );
    return this.messaging.view(message, access, userId);
  }

  /** Background: transcode, poster, preview, watermark if protected, then the frame check. */
  async processVideo(messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { select: { participants: { select: { userId: true } } } } },
    });
    if (!message || message.kind !== 'VIDEO' || message.mediaStatus !== 'PENDING') return;
    const raw = await this.storage.get(uploadKey(messageId));
    if (!raw || message.deletedAt) {
      await this.storage.delete(uploadKey(messageId)).catch(() => undefined);
      return;
    }
    const recipient = message.conversation.participants.find((p) => p.userId !== message.senderId);
    const protectedVideo = message.viewOnce || message.timerSeconds !== null || message.sensitive;
    const text =
      protectedVideo && recipient
        ? await this.watermarkFor(recipient.userId, message.createdAt)
        : null;
    try {
      const video = await transcodeVideo(
        raw,
        { ffmpeg: this.env.FFMPEG_PATH, ffprobe: this.env.FFPROBE_PATH },
        text ? (w, h) => watermarkOverlay(w, h, text) : undefined,
      );
      const poster = await sharp(video.poster)
        .resize({
          width: POSTER_EDGE,
          height: POSTER_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .avif(AVIF)
        .toBuffer();
      const base = `messages/${message.conversationId}/${messageId}`;
      const keys = {
        mediaKey: `${base}.mp4`,
        mediaPosterKey: `${base}.poster.${IMAGE_FORMAT.extension}`,
        mediaPreviewKey: `${base}.preview.${IMAGE_FORMAT.extension}`,
      };
      await Promise.all([
        this.storage.put(keys.mediaKey, video.mp4, 'video/mp4'),
        this.storage.put(keys.mediaPosterKey, poster, IMAGE_FORMAT.contentType),
        this.storage.put(
          keys.mediaPreviewKey,
          await blurredPreview(poster),
          IMAGE_FORMAT.contentType,
        ),
      ]);
      const stored = await this.prisma.message.updateMany({
        where: { id: messageId, deletedAt: null },
        data: {
          ...keys,
          mediaBytes: video.mp4.byteLength,
          mediaDurationMs: video.durationMs,
          mediaWidth: video.width,
          mediaHeight: video.height,
        },
      });
      if (stored.count === 0) {
        // Removed while it was being prepared: keep nothing.
        for (const key of Object.values(keys))
          await this.storage.delete(key).catch(() => undefined);
        return;
      }
      await this.moderation.assessVideoFrames(messageId, video.frames);
    } catch {
      await this.moderation.failVideo(messageId);
    } finally {
      await this.storage.delete(uploadKey(messageId)).catch(() => undefined);
    }
  }
}

/** Where an uploaded clip waits for processing. Never served. */
function uploadKey(messageId: string): string {
  return `uploads/video/${messageId}`;
}
