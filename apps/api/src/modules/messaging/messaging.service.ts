import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ConversationChangedEvent,
  type ConversationList,
  type ConversationSettings,
  type ConversationSummary,
  datePlanPayloadSchema,
  type DatePlanPayload,
  type MessagePage,
  MESSAGES_PAGE_SIZE,
  type MessageView,
  type SendMessage,
  SOCKET_EVENTS,
  chatThemeSchema,
  disappearSecondsSchema,
  EDIT_WINDOW_MINUTES,
  OPEN_URL_SECONDS,
  reactionSchema,
} from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import {
  type MediaConsent,
  type Message,
  type MessageReaction,
  Prisma,
} from '../../generated/prisma/client.js';
import { CompatibilityService } from '../compatibility/compatibility.service.js';
import { PeopleService } from '../compatibility/people.service.js';
import { MediaUrlService } from '../storage/media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.js';
import { NotificationService } from './notification.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';

const NOT_FOUND = 'Not found.';

const MEDIA_KINDS: ReadonlySet<Message['kind']> = new Set(['IMAGE', 'VOICE', 'VIDEO']);

/** What `view()` needs besides the row itself. */
export const VIEW_INCLUDE = { reactions: true, replyTo: true } as const;
export type ViewableMessage = Message & {
  reactions?: readonly MessageReaction[];
  replyTo?: Message | null;
};
const PREVIEW_LENGTH = 80;

type Tx = Prisma.TransactionClient;

/** One conversation as seen by one of its two participants. */
export interface ConversationAccess {
  readonly conversationId: string;
  readonly matchId: string;
  readonly me: {
    mediaConsent: MediaConsent;
    lastReadAt: Date | null;
    sendsReadReceipts: boolean;
    sharesTyping: boolean;
    wingmanContextEnabled: boolean;
    mutedAt: Date | null;
    restricted: boolean;
  };
  readonly otherId: string;
  readonly other: {
    lastReadAt: Date | null;
    sendsReadReceipts: boolean;
    sharesTyping: boolean;
    /** The other person restricted the viewer. */
    restricted: boolean;
    /** Whether the other person sees the viewer's media yet. */
    mediaConsent: MediaConsent;
  };
  /** Active connection, nobody blocked, both accounts usable. */
  readonly writable: boolean;
  /** The conversation's shared theme. */
  readonly theme: string;
  /** Shared disappearing-messages timer (null = off). */
  readonly disappearSeconds: number | null;
  /** The viewer blurs every photo and video from others until tapped. */
  readonly blurIncoming: boolean;
}

/**
 * Conversations between mutual connections. One rule decides access
 * (`access`): only the two participants, never across a block, never with a
 * deleted or suspended account. When a connection ends the history stays,
 * read-only. Message text is never logged or audited.
 */
@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly compatibility: CompatibilityService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationService,
    private readonly media: MediaUrlService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  /**
   * Creates the pair's conversation (or reopens it, keeping history) inside the
   * transaction that creates the match, and notes the connection in it.
   */
  static async openConversation(
    tx: Tx,
    matchId: string,
    userAId: string,
    userBId: string,
  ): Promise<string> {
    // New conversations start from each person's privacy defaults.
    const profiles = await tx.userProfile.findMany({
      where: { userId: { in: [userAId, userBId] } },
      select: {
        userId: true,
        defaultReadReceipts: true,
        defaultSharesTyping: true,
        defaultMediaConsent: true,
        defaultDisappearSeconds: true,
      },
    });
    const defaults = (userId: string) => {
      const profile = profiles.find((p) => p.userId === userId);
      return {
        userId,
        sendsReadReceipts: profile?.defaultReadReceipts ?? true,
        sharesTyping: profile?.defaultSharesTyping ?? true,
        // Ask first unless this person chose to allow media by default.
        mediaConsent: profile?.defaultMediaConsent === 'allow' ? 'ALLOWED' : 'ASK',
      } as const;
    };
    // Disappearing messages: the shorter of the two defaults wins (the more private choice).
    const timers = profiles.flatMap((p) => p.defaultDisappearSeconds ?? []);
    const disappearSeconds = timers.length > 0 ? Math.min(...timers) : null;
    const conversation = await tx.conversation.upsert({
      where: { matchId },
      create: {
        matchId,
        disappearSeconds,
        participants: { create: [defaults(userAId), defaults(userBId)] },
      },
      update: {},
    });
    const at = new Date();
    await tx.message.create({
      data: {
        conversationId: conversation.id,
        kind: 'SYSTEM',
        payload: { event: 'connected' },
        createdAt: at,
      },
    });
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: at },
    });
    return conversation.id;
  }

  /** The conversation for an active or ended match, created if an older match has none. */
  async conversationForMatch(matchId: string): Promise<string> {
    const existing = await this.prisma.conversation.findUnique({ where: { matchId } });
    if (existing) return existing.id;
    const match = await this.prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    return this.prisma.$transaction((tx) =>
      MessagingService.openConversation(tx, matchId, match.userAId, match.userBId),
    );
  }

  // ─────────────────────────── access ───────────────────────────

  async access(userId: string, conversationId: string): Promise<ConversationAccess> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true, match: true },
    });
    const me = conversation?.participants.find((p) => p.userId === userId);
    const other = conversation?.participants.find((p) => p.userId !== userId);
    if (!conversation || !me || !other) throw new NotFoundException(NOT_FOUND);
    if (await this.people.isBlocked(userId, other.userId)) throw new NotFoundException(NOT_FOUND);
    const loaded = await this.people.load([other.userId]);
    if (!loaded.get(other.userId)?.reachable) throw new NotFoundException(NOT_FOUND);
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { blurIncomingMedia: true },
    });
    return {
      conversationId,
      matchId: conversation.matchId,
      me,
      otherId: other.userId,
      other,
      writable: conversation.match.endedAt === null,
      theme: conversation.theme,
      disappearSeconds: conversation.disappearSeconds,
      blurIncoming: profile?.blurIncomingMedia ?? false,
    };
  }

  async writable(userId: string, conversationId: string): Promise<ConversationAccess> {
    const access = await this.access(userId, conversationId);
    if (!access.writable) throw new ConflictException('This connection has ended.');
    return access;
  }

  /** Tells both participants' apps that something changed. Ids only. */
  changed(access: ConversationAccess, userId: string, reason: ConversationChangedEvent['reason']) {
    const event: ConversationChangedEvent = {
      conversationId: access.conversationId,
      reason,
      by: userId,
    };
    this.realtime.emit([userId, access.otherId], SOCKET_EVENTS.conversationChanged, event);
  }

  // ─────────────────────────── reading ───────────────────────────

  preview(message: Message, viewerId: string): string {
    if (message.deletedAt || this.expired(message)) return 'Message removed';
    if (message.reportedAt && message.senderId !== viewerId) return 'Message reported';
    switch (message.kind) {
      case 'TEXT': {
        const body = message.body ?? '';
        return body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH - 1)}…` : body;
      }
      case 'IMAGE':
        return 'Photo';
      case 'VOICE':
        return 'Voice note';
      case 'VIDEO':
        return 'Video';
      case 'DATE_PLAN':
        return 'Date idea';
      case 'SYSTEM':
        switch (this.systemEvent(message).event) {
          case 'theme':
            return message.senderId === viewerId ? 'You changed the theme' : 'Theme changed';
          case 'disappear':
            return 'Disappearing messages changed';
          default:
            return 'You’re connected';
        }
    }
  }

  /** What a system message records: a connection, or a theme change. */
  private systemEvent(message: Message): Pick<MessageView, 'event' | 'theme' | 'disappearSeconds'> {
    const payload = (message.payload ?? {}) as {
      event?: unknown;
      theme?: unknown;
      seconds?: unknown;
    };
    if (payload.event === 'theme') {
      const theme = chatThemeSchema.safeParse(payload.theme);
      return {
        event: 'theme',
        theme: theme.success ? theme.data : 'default',
        disappearSeconds: null,
      };
    }
    if (payload.event === 'disappear')
      return {
        event: 'disappear',
        theme: null,
        disappearSeconds: typeof payload.seconds === 'number' ? payload.seconds : null,
      };
    return { event: 'connected', theme: null, disappearSeconds: null };
  }

  /** Past its expiry but not swept yet: treated as gone everywhere. */
  expired(message: Pick<Message, 'expiresAt'>, now = Date.now()): boolean {
    return message.expiresAt !== null && message.expiresAt.getTime() <= now;
  }

  /** Media the viewer may not see yet is left out entirely, not shown as a placeholder. */
  visibleTo(message: Message, viewerId: string): boolean {
    if (message.senderId === viewerId || message.kind === 'SYSTEM') return true;
    return message.mediaStatus !== 'REJECTED';
  }

  /**
   * One message as this viewer may see it. `opened` signs view-once and timed
   * media for the recipient (only the open endpoint passes it).
   */
  view(
    message: ViewableMessage,
    access: ConversationAccess,
    viewerId: string,
    opened = false,
  ): MessageView {
    const mine = message.senderId === viewerId;
    const expiredNow = message.deletedAt === null && this.expired(message);
    const removed =
      message.deletedAt !== null || expiredNow || (!mine && message.reportedAt !== null);
    const kind = (
      {
        TEXT: 'text',
        IMAGE: 'image',
        VOICE: 'voice',
        VIDEO: 'video',
        DATE_PLAN: 'date_plan',
        SYSTEM: 'system',
      } as const
    )[message.kind];
    const isMedia = MEDIA_KINDS.has(message.kind);
    const timed = message.timerSeconds !== null && message.kind !== 'TEXT';
    const protectedMedia = isMedia && (message.viewOnce || timed);
    // Media waits for the recipient's consent; the sender sees that it is waiting.
    const held =
      isMedia &&
      !removed &&
      (mine ? access.other.mediaConsent === 'ASK' : access.me.mediaConsent === 'ASK');
    const removedReason: MessageView['removedReason'] = !removed
      ? null
      : expiredNow ||
          (message.expiresAt !== null &&
            message.deletedAt !== null &&
            message.expiresAt <= message.deletedAt)
        ? 'expired'
        : message.viewOnce && message.openedAt !== null
          ? 'opened'
          : 'sender';
    let media: MessageView['media'] = null;
    if (!removed && message.mediaStatus && (message.mediaKey || message.kind === 'VIDEO')) {
      const approved = message.mediaStatus === 'APPROVED';
      // Who gets which URLs: the sender everything; the recipient nothing while
      // held, only the blurred preview for unopened protected media, and
      // one-minute "opened" URLs from the open endpoint.
      const full = (key: string | null) => {
        // A video still being processed has only its raw upload: nothing to show yet.
        if (!key || key.startsWith('uploads/')) return null;
        if (mine) return this.media.sign(key, 'owner');
        if (!approved || held) return null;
        if (protectedMedia)
          return opened ? this.media.sign(key, 'opened', Date.now(), OPEN_URL_SECONDS) : null;
        return this.media.sign(key, 'conversation');
      };
      const preview = (key: string | null) =>
        !key
          ? null
          : mine
            ? this.media.sign(key, 'owner')
            : approved && !held
              ? this.media.sign(key, 'conversation')
              : null;
      media = {
        status: approved ? 'ready' : message.mediaStatus === 'REJECTED' ? 'declined' : 'checking',
        url: full(message.mediaKey),
        thumbUrl: full(message.mediaThumbKey),
        altUrl: full(message.mediaAltKey),
        posterUrl: full(message.mediaPosterKey),
        previewUrl: preview(message.mediaPreviewKey),
        width: message.mediaWidth,
        height: message.mediaHeight,
        durationMs: message.mediaDurationMs,
      };
    }
    const plan =
      !removed && message.kind === 'DATE_PLAN'
        ? (datePlanPayloadSchema.safeParse(message.payload).data ?? null)
        : null;
    // Receipts flow only when both share them and the other person hasn't restricted the viewer.
    const bothShare =
      access.me.sendsReadReceipts && access.other.sendsReadReceipts && !access.other.restricted;
    const reactions = new Map<string, { count: number; mine: boolean }>();
    if (!removed)
      for (const r of message.reactions ?? []) {
        const entry = reactions.get(r.emoji) ?? { count: 0, mine: false };
        reactions.set(r.emoji, {
          count: entry.count + 1,
          mine: entry.mine || r.userId === viewerId,
        });
      }
    const replyTo = message.replyTo
      ? {
          id: message.replyTo.id,
          mine: message.replyTo.senderId === viewerId,
          preview: this.preview(message.replyTo, viewerId),
        }
      : null;
    return {
      id: message.id,
      conversationId: message.conversationId,
      clientId: mine ? message.clientId : null,
      mine,
      kind,
      body: removed || message.kind !== 'TEXT' ? null : message.body,
      removed,
      media,
      plan,
      ...(message.kind === 'SYSTEM'
        ? this.systemEvent(message)
        : { event: null, theme: null, disappearSeconds: null }),
      removedReason,
      viewOnce: message.viewOnce,
      timerSeconds: message.timerSeconds,
      sensitive: message.sensitive,
      // Your own media can always be kept; theirs only if they allowed it and you can see it.
      savable:
        (message.kind === 'IMAGE' || message.kind === 'VIDEO') &&
        !removed &&
        message.mediaStatus === 'APPROVED' &&
        (mine || (!held && message.allowSave && !protectedMedia)),
      blurred:
        !removed &&
        (message.kind === 'IMAGE' || message.kind === 'VIDEO') &&
        (protectedMedia || message.sensitive || (!mine && access.blurIncoming)),
      held,
      openable:
        !mine &&
        protectedMedia &&
        !removed &&
        !held &&
        message.mediaStatus === 'APPROVED' &&
        !(message.viewOnce && message.openedAt !== null),
      openedAt: message.openedAt?.toISOString() ?? null,
      expiresAt: removed ? null : (message.expiresAt?.toISOString() ?? null),
      read:
        mine &&
        bothShare &&
        access.other.lastReadAt !== null &&
        access.other.lastReadAt >= message.createdAt,
      replyTo,
      reactions: [...reactions].flatMap(([emoji, r]) => {
        const parsed = reactionSchema.safeParse(emoji);
        return parsed.success ? [{ emoji: parsed.data, ...r }] : [];
      }),
      edited: !removed && message.editedAt !== null,
      pinned: !removed && message.pinnedAt !== null,
      forwarded: message.forwarded,
      editable:
        mine &&
        !removed &&
        message.kind === 'TEXT' &&
        Date.now() - message.createdAt.getTime() < EDIT_WINDOW_MINUTES * 60_000,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private settings(access: ConversationAccess): ConversationSettings {
    return {
      sendsReadReceipts: access.me.sendsReadReceipts,
      sharesTyping: access.me.sharesTyping,
      wingmanContextEnabled: access.me.wingmanContextEnabled,
      muted: access.me.mutedAt !== null,
      restricted: access.me.restricted,
      theme: chatThemeSchema.catch('default').parse(access.theme),
      disappearSeconds: disappearSecondsSchema
        .nullable()
        .catch(null)
        .parse(access.disappearSeconds),
      mediaConsent: access.me.mediaConsent === 'ALLOWED' ? 'allowed' : 'ask',
    };
  }

  async list(userId: string): Promise<ConversationList> {
    const rows = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: { conversation: { include: { participants: true, match: true } } },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
    });
    const otherIds = rows.flatMap(
      (r) => r.conversation.participants.find((p) => p.userId !== userId)?.userId ?? [],
    );
    const [summaries, blocks] = await Promise.all([
      this.compatibility.summaries(userId, otherIds),
      this.prisma.blockedUser.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      }),
    ]);
    const blocked = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]));
    const conversations: ConversationSummary[] = [];
    for (const row of rows) {
      const other = row.conversation.participants.find((p) => p.userId !== userId);
      const person = other ? summaries.get(other.userId) : undefined;
      if (!other || !person || blocked.has(other.userId)) continue;
      const access: ConversationAccess = {
        conversationId: row.conversationId,
        matchId: row.conversation.matchId,
        me: row,
        otherId: other.userId,
        other,
        writable: row.conversation.match.endedAt === null,
        theme: row.conversation.theme,
        disappearSeconds: row.conversation.disappearSeconds,
        blurIncoming: false, // the list never shows media
      };
      const last = await this.prisma.message.findFirst({
        where: {
          conversationId: row.conversationId,
          OR: [{ senderId: userId }, { mediaStatus: null }, { mediaStatus: { not: 'REJECTED' } }],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const unread = await this.prisma.message.count({
        where: {
          conversationId: row.conversationId,
          senderId: other.userId,
          deletedAt: null,
          ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}),
        },
        take: 1,
      });
      conversations.push({
        id: row.conversationId,
        person,
        lastMessage: last
          ? {
              preview: this.preview(last, userId),
              mine: last.senderId === userId,
              at: last.createdAt.toISOString(),
            }
          : null,
        unread: unread > 0,
        readOnly: !access.writable,
        settings: this.settings(access),
      });
    }
    return { conversations };
  }

  async summary(userId: string, conversationId: string): Promise<ConversationSummary> {
    await this.access(userId, conversationId);
    const found = (await this.list(userId)).conversations.find((c) => c.id === conversationId);
    if (!found) throw new NotFoundException(NOT_FOUND);
    return found;
  }

  async messages(
    userId: string,
    conversationId: string,
    before: string | undefined,
    limit = MESSAGES_PAGE_SIZE,
  ): Promise<MessagePage> {
    const access = await this.access(userId, conversationId);
    let cursor: { createdAt: Date; id: string } | null = null;
    if (before) {
      cursor = await this.prisma.message.findFirst({
        where: { id: before, conversationId },
        select: { createdAt: true, id: true },
      });
      if (!cursor) throw new NotFoundException(NOT_FOUND);
    }
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: VIEW_INCLUDE,
    });
    const page = rows.slice(0, limit);
    return {
      // Newest first; the app renders an inverted list.
      messages: page
        .filter((m) => this.visibleTo(m, userId))
        .map((m) => this.view(m, access, userId)),
      nextBefore: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  // ─────────────────────────── writing ───────────────────────────

  async send(userId: string, conversationId: string, input: SendMessage): Promise<MessageView> {
    const access = await this.writable(userId, conversationId);
    const existing = await this.prisma.message.findUnique({
      where: { conversationId_clientId: { conversationId, clientId: input.clientId } },
      include: VIEW_INCLUDE,
    });
    // A retry of a send that already succeeded returns the same message.
    if (existing) {
      if (existing.senderId !== userId) throw new ConflictException('Try sending again.');
      return this.view(existing, access, userId);
    }
    const data: Prisma.MessageUncheckedCreateInput =
      input.kind === 'text'
        ? {
            conversationId,
            senderId: userId,
            clientId: input.clientId,
            kind: 'TEXT',
            body: input.body,
            aiAssisted: input.aiAssisted ?? false,
            replyToId: await this.replyTarget(conversationId, input.replyToId),
            timerSeconds: input.timerSeconds ?? null,
          }
        : {
            conversationId,
            senderId: userId,
            clientId: input.clientId,
            kind: 'DATE_PLAN',
            payload: {
              idea: input.plan.idea,
              when: input.plan.when ?? null,
              area: input.plan.area ?? null,
              status: 'proposed',
              respondedAt: null,
            } satisfies DatePlanPayload,
          };
    const message = await this.store(data);
    // Sending also means you have read everything before it.
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: message.createdAt },
    });
    this.changed(access, userId, 'message');
    await this.notifyNewMessage(access, userId);
    return this.view(message, access, userId);
  }

  /** Writes a message and moves the conversation to the top of both lists. */
  async store(data: Prisma.MessageUncheckedCreateInput) {
    return this.prisma.$transaction(async (tx) => {
      // Disappearing messages: everything people send (not system lines) gets an expiry.
      if (data.kind !== 'SYSTEM') {
        const conversation = await tx.conversation.findUniqueOrThrow({
          where: { id: data.conversationId },
          select: { disappearSeconds: true },
        });
        if (conversation.disappearSeconds)
          data = {
            ...data,
            expiresAt: new Date(Date.now() + conversation.disappearSeconds * 1000),
          };
      }
      const message = await tx.message.create({ data, include: VIEW_INCLUDE });
      await tx.conversation.update({
        where: { id: data.conversationId },
        data: { lastMessageAt: message.createdAt },
      });
      return message;
    });
  }

  /** A reply must quote a message in the same conversation that still exists. */
  async replyTarget(conversationId: string, replyToId: string | undefined) {
    if (!replyToId) return null;
    const target = await this.prisma.message.findFirst({
      where: { id: replyToId, conversationId, deletedAt: null, kind: { not: 'SYSTEM' } },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('That message is no longer available.');
    return target.id;
  }

  async notifyNewMessage(access: ConversationAccess, senderId: string): Promise<void> {
    const recipient = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId: access.conversationId, userId: access.otherId },
      },
    });
    // Restricted people's messages arrive quietly.
    if (!recipient || recipient.mutedAt || recipient.restricted) return;
    await this.notifications.notify(access.otherId, {
      kind: 'message',
      fromUserId: senderId,
      conversationId: access.conversationId,
    });
  }

  async markRead(userId: string, conversationId: string, upTo: string): Promise<void> {
    const access = await this.access(userId, conversationId);
    const message = await this.prisma.message.findFirst({
      where: { id: upTo, conversationId },
      select: { createdAt: true },
    });
    if (!message) throw new NotFoundException(NOT_FOUND);
    const updated = await this.prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId,
        OR: [{ lastReadAt: null }, { lastReadAt: { lt: message.createdAt } }],
      },
      data: { lastReadAt: message.createdAt },
    });
    if (updated.count === 0) return;
    // Self-destructing text starts its timer once read (never extending an earlier expiry).
    await this.prisma.$executeRaw`
      update messages
         set expires_at = least(coalesce(expires_at, 'infinity'),
                                now() + timer_seconds * interval '1 second')
       where conversation_id = ${conversationId}::uuid
         and sender_id = ${access.otherId}::uuid
         and kind = 'TEXT' and timer_seconds is not null and deleted_at is null
         and created_at <= ${message.createdAt}`;
    // The other person only hears about it when this person shares read receipts.
    // Nor when this person restricted them.
    if (access.me.sendsReadReceipts && !access.me.restricted) this.changed(access, userId, 'read');
    else
      this.realtime.emit([userId], SOCKET_EVENTS.conversationChanged, {
        conversationId,
        reason: 'read',
      } satisfies ConversationChangedEvent);
  }

  async updateSettings(
    userId: string,
    conversationId: string,
    update: Partial<ConversationSettings>,
  ): Promise<ConversationSettings> {
    const access = await this.access(userId, conversationId);
    // The theme is shared: either person can change it, and both see a note.
    let theme = access.theme;
    if (update.theme !== undefined && update.theme !== access.theme) {
      if (!access.writable) throw new ConflictException('This connection has ended.');
      theme = update.theme;
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { theme } });
      await this.store({
        conversationId,
        senderId: userId,
        kind: 'SYSTEM',
        payload: { event: 'theme', theme },
      });
      this.changed(access, userId, 'message');
    }
    // Disappearing messages are shared too, with a note for both.
    let disappearSeconds = access.disappearSeconds;
    if (
      update.disappearSeconds !== undefined &&
      update.disappearSeconds !== access.disappearSeconds
    ) {
      if (!access.writable) throw new ConflictException('This connection has ended.');
      disappearSeconds = update.disappearSeconds;
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { disappearSeconds },
      });
      await this.store({
        conversationId,
        senderId: userId,
        kind: 'SYSTEM',
        payload: { event: 'disappear', seconds: disappearSeconds },
      });
      this.changed(access, userId, 'message');
    }
    const row = await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: {
        ...(update.sendsReadReceipts === undefined
          ? {}
          : { sendsReadReceipts: update.sendsReadReceipts }),
        ...(update.sharesTyping === undefined ? {} : { sharesTyping: update.sharesTyping }),
        ...(update.wingmanContextEnabled === undefined
          ? {}
          : { wingmanContextEnabled: update.wingmanContextEnabled }),
        ...(update.muted === undefined ? {} : { mutedAt: update.muted ? new Date() : null }),
        ...(update.restricted === undefined ? {} : { restricted: update.restricted }),
        ...(update.mediaConsent === undefined
          ? {}
          : { mediaConsent: update.mediaConsent === 'allowed' ? 'ALLOWED' : 'ASK' }),
      },
    });
    // The sender's "waiting for them to allow media" changes with consent.
    if (update.mediaConsent !== undefined) this.changed(access, userId, 'settings');
    // Read receipts are reciprocal (and restriction hides them), so the other side's ticks may change too.
    if (update.sendsReadReceipts !== undefined || update.restricted !== undefined)
      this.changed(access, userId, 'read');
    return this.settings({ ...access, me: row, theme, disappearSeconds });
  }

  /** The sender removes a message for both people. Text and media are erased, not hidden. */
  async remove(userId: string, messageId: string): Promise<void> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, senderId: userId, deletedAt: null },
    });
    if (!message) throw new NotFoundException(NOT_FOUND);
    const access = await this.access(userId, message.conversationId);
    await this.erase(message);
    this.changed(access, userId, 'removed');
  }

  /**
   * Erases a message's content for good: text, payload and every stored file.
   * Used for removal, view-once after opening, timers and disappearing messages.
   * Returns false if it was already erased.
   */
  async erase(message: Message, at = new Date()): Promise<boolean> {
    const erased = await this.prisma.message.updateMany({
      where: { id: message.id, deletedAt: null },
      data: {
        deletedAt: at,
        body: null,
        mediaKey: null,
        mediaThumbKey: null,
        mediaAltKey: null,
        mediaPosterKey: null,
        mediaPreviewKey: null,
        mediaBytes: null,
        mediaStatus: null,
        mediaDurationMs: null,
        mediaWidth: null,
        mediaHeight: null,
        payload: Prisma.DbNull,
        pinnedAt: null,
      },
    });
    if (erased.count === 0) return false;
    await this.prisma.messageReaction.deleteMany({ where: { messageId: message.id } });
    const keys = [
      message.mediaKey,
      message.mediaThumbKey,
      message.mediaAltKey,
      message.mediaPosterKey,
      message.mediaPreviewKey,
    ];
    for (const key of keys) if (key) await this.storage.delete(key).catch(() => undefined);
    return true;
  }

  // ─────────────────────────── date plans ───────────────────────────

  async respondToPlan(
    userId: string,
    messageId: string,
    action: 'accept' | 'decline' | 'withdraw',
  ): Promise<MessageView> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, kind: 'DATE_PLAN', deletedAt: null },
    });
    if (!message) throw new NotFoundException(NOT_FOUND);
    const access = await this.writable(userId, message.conversationId);
    const plan = datePlanPayloadSchema.safeParse(message.payload).data;
    const mine = message.senderId === userId;
    // Only the recipient accepts or declines; only the proposer withdraws.
    if (!plan || mine !== (action === 'withdraw')) throw new NotFoundException(NOT_FOUND);
    if (plan.status !== 'proposed') throw new ConflictException('This plan was already answered.');
    const status = ({ accept: 'accepted', decline: 'declined', withdraw: 'withdrawn' } as const)[
      action
    ];
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        payload: {
          ...plan,
          status,
          respondedAt: new Date().toISOString(),
        } satisfies DatePlanPayload,
      },
    });
    this.changed(access, userId, 'plan');
    return this.view(updated, access, userId);
  }

  /** Called when a connection ends or someone blocks: both apps refresh. */
  connectionChanged(userIds: readonly string[]): void {
    this.realtime.emit(userIds, SOCKET_EVENTS.listChanged, {});
  }
}
