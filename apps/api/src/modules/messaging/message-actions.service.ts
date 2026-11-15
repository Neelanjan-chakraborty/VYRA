import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  EDIT_WINDOW_MINUTES,
  MAX_PINNED,
  MAX_SCHEDULED_PER_CONVERSATION,
  type MessageView,
  type PinnedList,
  type Reaction,
  SCHEDULE_MAX_DAYS,
  type ScheduledList,
  type ScheduledMessageView,
} from '@vyra/validation';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service.js';
import type { ScheduledMessage } from '../../generated/prisma/client.js';
import { SCHEDULED_MESSAGES_QUEUE } from '../../queue/queue.module.js';
import { MessagingService, VIEW_INCLUDE } from './messaging.service.js';

const NOT_FOUND = 'Not found.';

export interface ScheduledJob {
  readonly scheduledId: string;
}

/**
 * What people do to messages after sending: react, pin, edit, forward, and
 * send later. Every action re-checks access through MessagingService, so a
 * block, an ended connection or a removed message stops it the same way.
 */
@Injectable()
export class MessageActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    @InjectQueue(SCHEDULED_MESSAGES_QUEUE) private readonly queue: Queue<ScheduledJob>,
  ) {}

  /** A message this person can see and act on, with write access to its conversation. */
  private async load(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: VIEW_INCLUDE,
    });
    if (!message || message.deletedAt || message.kind === 'SYSTEM')
      throw new NotFoundException(NOT_FOUND);
    const access = await this.messaging.writable(userId, message.conversationId);
    if (!this.messaging.visibleTo(message, userId)) throw new NotFoundException(NOT_FOUND);
    return { message, access };
  }

  private async reload(userId: string, messageId: string): Promise<MessageView> {
    const { message, access } = await this.load(userId, messageId);
    return this.messaging.view(message, access, userId);
  }

  // ─────────────────────────── reactions ───────────────────────────

  /** One reaction per person per message; reacting again replaces it. */
  async react(userId: string, messageId: string, emoji: Reaction): Promise<MessageView> {
    const { access } = await this.load(userId, messageId);
    await this.prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, emoji },
      update: { emoji, createdAt: new Date() },
    });
    this.messaging.changed(access, userId, 'reaction');
    return this.reload(userId, messageId);
  }

  async unreact(userId: string, messageId: string): Promise<MessageView> {
    const { access } = await this.load(userId, messageId);
    const removed = await this.prisma.messageReaction.deleteMany({ where: { messageId, userId } });
    if (removed.count > 0) this.messaging.changed(access, userId, 'reaction');
    return this.reload(userId, messageId);
  }

  // ─────────────────────────── pins ───────────────────────────

  /** Either person can pin; both see it. At most three at once. */
  async pin(userId: string, messageId: string): Promise<MessageView> {
    const { message, access } = await this.load(userId, messageId);
    if (message.pinnedAt) return this.messaging.view(message, access, userId);
    const pinned = await this.prisma.message.count({
      where: { conversationId: message.conversationId, pinnedAt: { not: null }, deletedAt: null },
    });
    if (pinned >= MAX_PINNED)
      throw new ConflictException(`You can pin up to ${MAX_PINNED} messages. Unpin one first.`);
    await this.prisma.message.update({ where: { id: messageId }, data: { pinnedAt: new Date() } });
    this.messaging.changed(access, userId, 'pinned');
    return this.reload(userId, messageId);
  }

  async unpin(userId: string, messageId: string): Promise<MessageView> {
    const { message, access } = await this.load(userId, messageId);
    if (message.pinnedAt) {
      await this.prisma.message.update({ where: { id: messageId }, data: { pinnedAt: null } });
      this.messaging.changed(access, userId, 'pinned');
    }
    return this.reload(userId, messageId);
  }

  async pinned(userId: string, conversationId: string): Promise<PinnedList> {
    const access = await this.messaging.access(userId, conversationId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId, pinnedAt: { not: null }, deletedAt: null },
      orderBy: { pinnedAt: 'desc' },
      take: MAX_PINNED,
      include: VIEW_INCLUDE,
    });
    return {
      messages: rows
        .filter((m) => this.messaging.visibleTo(m, userId))
        .map((m) => this.messaging.view(m, access, userId)),
    };
  }

  // ─────────────────────────── edit & forward ───────────────────────────

  /** Your own text, within 15 minutes. The earlier text is replaced, not kept. */
  async edit(userId: string, messageId: string, body: string): Promise<MessageView> {
    const { message, access } = await this.load(userId, messageId);
    if (message.senderId !== userId || message.kind !== 'TEXT')
      throw new NotFoundException(NOT_FOUND);
    if (Date.now() - message.createdAt.getTime() >= EDIT_WINDOW_MINUTES * 60_000)
      throw new ConflictException(`Messages can be edited for ${EDIT_WINDOW_MINUTES} minutes.`);
    if (message.body === body) return this.messaging.view(message, access, userId);
    await this.prisma.message.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
    });
    this.messaging.changed(access, userId, 'edited');
    return this.reload(userId, messageId);
  }

  /**
   * Only your own text can be forwarded, and only to your other conversations.
   * Someone else's words, and every photo or voice note, stay where they were sent.
   */
  async forward(userId: string, messageId: string, conversationIds: readonly string[]) {
    const { message } = await this.load(userId, messageId);
    if (message.senderId !== userId || message.kind !== 'TEXT' || !message.body)
      throw new UnprocessableEntityException('Only your own messages can be forwarded.');
    const targets = [...new Set(conversationIds)].filter((c) => c !== message.conversationId);
    if (targets.length === 0)
      throw new UnprocessableEntityException('Choose another conversation to forward to.');
    // Check every destination before sending to any of them.
    const accesses = await Promise.all(targets.map((c) => this.messaging.writable(userId, c)));
    for (const access of accesses) {
      await this.messaging.store({
        conversationId: access.conversationId,
        senderId: userId,
        clientId: randomUUID(),
        kind: 'TEXT',
        body: message.body,
        forwarded: true,
      });
      this.messaging.changed(access, userId, 'message');
      await this.messaging.notifyNewMessage(access, userId);
    }
    return { forwarded: accesses.length };
  }

  // ─────────────────────────── scheduled ───────────────────────────

  private scheduledView(row: ScheduledMessage): ScheduledMessageView {
    return {
      id: row.id,
      conversationId: row.conversationId,
      body: row.body,
      sendAt: row.sendAt.toISOString(),
      status: row.status,
    };
  }

  async schedule(
    userId: string,
    conversationId: string,
    body: string,
    sendAtIso: string,
  ): Promise<ScheduledMessageView> {
    await this.messaging.writable(userId, conversationId);
    const sendAt = new Date(sendAtIso);
    const delay = sendAt.getTime() - Date.now();
    if (delay <= 0 || delay > SCHEDULE_MAX_DAYS * 86_400_000)
      throw new UnprocessableEntityException({
        message: 'Some of the information provided is not valid.',
        details: [
          {
            path: 'sendAt',
            message: `Pick a time in the next ${SCHEDULE_MAX_DAYS} days`,
          },
        ],
      });
    const pending = await this.prisma.scheduledMessage.count({
      where: { conversationId, senderId: userId, status: 'PENDING' },
    });
    if (pending >= MAX_SCHEDULED_PER_CONVERSATION)
      throw new ConflictException('You have enough messages waiting here already.');
    const row = await this.prisma.scheduledMessage.create({
      data: { conversationId, senderId: userId, body, sendAt },
    });
    await this.queue.add(
      'send',
      { scheduledId: row.id },
      { jobId: row.id, delay, removeOnComplete: true, removeOnFail: 100 },
    );
    return this.scheduledView(row);
  }

  /** Your own messages waiting to go out here (and any that couldn't). */
  async scheduled(userId: string, conversationId: string): Promise<ScheduledList> {
    await this.messaging.access(userId, conversationId);
    const rows = await this.prisma.scheduledMessage.findMany({
      where: { conversationId, senderId: userId, status: { in: ['PENDING', 'FAILED'] } },
      orderBy: { sendAt: 'asc' },
    });
    return { scheduled: rows.map((r) => this.scheduledView(r)) };
  }

  async cancel(userId: string, scheduledId: string): Promise<void> {
    const cancelled = await this.prisma.scheduledMessage.updateMany({
      where: { id: scheduledId, senderId: userId, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'CANCELLED' },
    });
    if (cancelled.count === 0) throw new NotFoundException(NOT_FOUND);
    await this.queue.remove(scheduledId).catch(() => undefined);
  }

  /**
   * Sends a scheduled message at its time, as if typed then. It is sent only
   * while the connection is still open; otherwise it is marked failed.
   * The schedule id is the client id, so a retried job never sends twice.
   */
  async deliver(scheduledId: string): Promise<void> {
    const row = await this.prisma.scheduledMessage.findUnique({ where: { id: scheduledId } });
    if (!row || row.status !== 'PENDING') return;
    try {
      const message = await this.messaging.send(row.senderId, row.conversationId, {
        kind: 'text',
        clientId: row.id,
        body: row.body,
      });
      await this.prisma.scheduledMessage.updateMany({
        where: { id: row.id, status: 'PENDING' },
        data: { status: 'SENT', messageId: message.id },
      });
    } catch {
      await this.prisma.scheduledMessage.updateMany({
        where: { id: row.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
    }
  }
}
