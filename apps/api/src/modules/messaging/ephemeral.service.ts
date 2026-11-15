import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { type MessageView, SOCKET_EVENTS } from '@vyra/validation';
import type { Queue } from 'bullmq';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../database/prisma.service.js';
import { EPHEMERAL_QUEUE } from '../../queue/queue.module.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { MessagingService, VIEW_INCLUDE } from './messaging.service.js';

const NOT_FOUND = 'Not found.';
/** A view-once item is erased this long after opening at the latest (or when closed). */
const VIEW_ONCE_GRACE_MS = 60_000;
const SWEEP_BATCH = 200;

export type EphemeralJob = { readonly messageId: string } | Record<string, never>;

/**
 * View once, timers and disappearing messages. The server is what enforces
 * them: content past its time is never returned, and the files are erased.
 * What a recipient's device displayed can still be captured by that device.
 */
@Injectable()
export class EphemeralService implements OnModuleInit {
  private readonly logger = new Logger(EphemeralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly realtime: RealtimeService,
    @Inject(ENV) private readonly env: Env,
    @InjectQueue(EPHEMERAL_QUEUE) private readonly queue: Queue<EphemeralJob>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.env.NODE_ENV === 'test') return; // tests call sweep() directly
    await this.queue
      .upsertJobScheduler('sweep', { every: 60_000 }, { name: 'sweep' })
      .catch((error: Error) =>
        this.logger.warn(`Could not schedule the sweeper: ${error.message}`),
      );
  }

  /**
   * The recipient opens view-once or timed media: they get one-minute URLs.
   * View once: only the first time, erased when closed (or a minute or so
   * after). Timed: the timer starts at the first open.
   */
  async open(userId: string, messageId: string): Promise<MessageView> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.senderId === userId || message.deletedAt)
      throw new NotFoundException(NOT_FOUND);
    const access = await this.messaging.access(userId, message.conversationId);
    const timed = message.timerSeconds !== null && message.kind !== 'TEXT';
    if (!(message.viewOnce || timed) || message.mediaStatus !== 'APPROVED' || message.reportedAt)
      throw new NotFoundException(NOT_FOUND);
    if (access.me.mediaConsent === 'ASK')
      throw new ConflictException('Allow media from them to open this.');
    if (this.messaging.expired(message)) throw new ConflictException('This has expired.');
    if (message.viewOnce && message.openedAt) throw new ConflictException('Already opened.');

    if (!message.openedAt) {
      const now = new Date();
      const timerEnd = timed ? new Date(now.getTime() + (message.timerSeconds ?? 0) * 1000) : null;
      const expiresAt =
        timerEnd && message.expiresAt && message.expiresAt < timerEnd
          ? message.expiresAt
          : timerEnd;
      const first = await this.prisma.message.updateMany({
        where: { id: messageId, openedAt: null },
        data: { openedAt: now, ...(expiresAt ? { expiresAt } : {}) },
      });
      if (first.count === 0 && message.viewOnce) throw new ConflictException('Already opened.');
      if (message.viewOnce)
        await this.queue.add(
          'erase',
          { messageId },
          {
            jobId: `erase-${messageId}`,
            delay: Math.max(VIEW_ONCE_GRACE_MS, (message.mediaDurationMs ?? 0) + 30_000),
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );
      this.messaging.changed(access, userId, 'opened');
    }
    const fresh = await this.prisma.message.findUniqueOrThrow({
      where: { id: messageId },
      include: VIEW_INCLUDE,
    });
    return this.messaging.view(fresh, access, userId, true);
  }

  /** The recipient closed a view-once item: erase it now rather than at the deadline. */
  async close(userId: string, messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.senderId === userId) throw new NotFoundException(NOT_FOUND);
    const access = await this.messaging.access(userId, message.conversationId);
    if (!message.viewOnce || !message.openedAt) return;
    if (await this.messaging.erase(message)) this.messaging.changed(access, userId, 'opened');
  }

  /** The deadline for a view-once item someone opened and never closed. */
  async eraseViewOnce(messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message?.viewOnce || !message.openedAt) return;
    if (await this.messaging.erase(message)) await this.tell(message.conversationId, 'opened');
  }

  /** Erases everything past its expiry. Runs every minute; returns how many it erased. */
  async sweep(now = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const due = await this.prisma.message.findMany({
        where: { expiresAt: { lte: now }, deletedAt: null },
        take: SWEEP_BATCH,
      });
      const conversations = new Set<string>();
      for (const message of due)
        if (await this.messaging.erase(message, now)) {
          total += 1;
          conversations.add(message.conversationId);
        }
      for (const id of conversations) await this.tell(id, 'expired');
      if (due.length < SWEEP_BATCH) break;
    }
    if (total > 0) this.logger.log(`Erased ${total} expired message(s)`);
    return total;
  }

  private async tell(conversationId: string, reason: 'opened' | 'expired'): Promise<void> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    this.realtime.emit(
      participants.map((p) => p.userId),
      SOCKET_EVENTS.conversationChanged,
      { conversationId, reason },
    );
  }
}
