import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type ConnectionItem,
  type Connections,
  type ConnectResult,
  DECLINE_COOLDOWN_DAYS,
  MAX_PENDING_OUTGOING,
  type RelationshipState,
} from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import type { DiscoveryEventType, Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { CompatibilityService } from '../compatibility/compatibility.service.js';
import { PeopleService } from '../compatibility/people.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { NotificationService } from '../messaging/notification.service.js';

const NOT_FOUND = 'Not found.';
const DAY_MS = 86_400_000;

const ordered = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

/**
 * Save, pass, connection requests, mutual connections and blocks. Every
 * action on another person first checks the shared visibility rule, and
 * every request or match can only be acted on by the people it belongs to.
 */
@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly compatibility: CompatibilityService,
    private readonly audit: AuditService,
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationService,
  ) {}

  private async requireVisible(viewerId: string, targetId: string): Promise<void> {
    if (!(await this.people.visiblePair(viewerId, targetId)))
      throw new NotFoundException(NOT_FOUND);
  }

  private event(
    userId: string,
    targetUserId: string,
    type: DiscoveryEventType,
    context: Prisma.InputJsonObject = {},
  ) {
    return this.prisma.discoveryEvent.create({ data: { userId, targetUserId, type, context } });
  }

  // ─────────────────────────── save and pass ───────────────────────────

  async save(userId: string, targetId: string): Promise<void> {
    await this.requireVisible(userId, targetId);
    await this.prisma.savedProfile.upsert({
      where: { userId_targetUserId: { userId, targetUserId: targetId } },
      create: { userId, targetUserId: targetId },
      update: {},
    });
    await this.event(userId, targetId, 'SAVED');
  }

  async unsave(userId: string, targetId: string): Promise<void> {
    const removed = await this.prisma.savedProfile.deleteMany({
      where: { userId, targetUserId: targetId },
    });
    if (removed.count > 0) await this.event(userId, targetId, 'UNSAVED');
  }

  /** "Not now": out of recommendations for PASS_HIDE_DAYS. Also unsaves. */
  async pass(userId: string, targetId: string): Promise<void> {
    await this.requireVisible(userId, targetId);
    await this.prisma.savedProfile.deleteMany({ where: { userId, targetUserId: targetId } });
    await this.event(userId, targetId, 'PASSED');
  }

  // ─────────────────────────── requests and matches ───────────────────────────

  async connect(
    senderId: string,
    recipientId: string,
    note: string | undefined,
    requestId: string,
  ): Promise<ConnectResult> {
    if (senderId === recipientId) throw new BadRequestException('You can’t connect with yourself.');
    await this.requireVisible(senderId, recipientId);
    const [low, high] = ordered(senderId, recipientId);
    if (
      (await this.prisma.match.count({ where: { userAId: low, userBId: high, endedAt: null } })) > 0
    ) {
      throw new ConflictException('You’re already connected.');
    }

    // They already asked: saying yes back makes it mutual straight away.
    const reverse = await this.prisma.connectionRequest.findUnique({
      where: { senderId_recipientId: { senderId: recipientId, recipientId: senderId } },
    });
    if (reverse?.status === 'PENDING') {
      const matchId = await this.acceptRequest(reverse.id, recipientId, senderId);
      await this.event(senderId, recipientId, 'CONNECTION_ACCEPTED', { via: 'mutual_request' });
      this.messaging.connectionChanged([senderId, recipientId]);
      await this.notifications.notify(recipientId, { kind: 'connected', fromUserId: senderId });
      return { outcome: 'matched', requestId: reverse.id, matchId };
    }

    const existing = await this.prisma.connectionRequest.findUnique({
      where: { senderId_recipientId: { senderId, recipientId } },
    });
    if (existing?.status === 'PENDING')
      throw new ConflictException('You’ve already asked to connect.');
    if (
      existing?.status === 'DECLINED' &&
      existing.respondedAt &&
      Date.now() - existing.respondedAt.getTime() < DECLINE_COOLDOWN_DAYS * DAY_MS
    ) {
      throw new ConflictException('You can’t ask this person again yet.');
    }
    const pending = await this.prisma.connectionRequest.count({
      where: { senderId, status: 'PENDING' },
    });
    if (pending >= MAX_PENDING_OUTGOING) {
      throw new ConflictException(
        `You have ${MAX_PENDING_OUTGOING} requests waiting. Withdraw some before sending more.`,
      );
    }

    const data = {
      status: 'PENDING' as const,
      note: note || null,
      createdAt: new Date(),
      respondedAt: null,
    };
    const request = existing
      ? await this.prisma.connectionRequest.update({ where: { id: existing.id }, data })
      : await this.prisma.connectionRequest.create({ data: { senderId, recipientId, ...data } });
    await this.event(senderId, recipientId, 'CONNECT_REQUESTED', { withNote: Boolean(note) });
    this.messaging.connectionChanged([senderId, recipientId]);
    await this.notifications.notify(recipientId, { kind: 'request', fromUserId: senderId });
    await this.audit.record({
      action: 'connections.requested',
      actorId: senderId,
      entityType: 'connection_request',
      entityId: request.id,
      requestId,
    });
    return { outcome: 'requested', requestId: request.id, matchId: null };
  }

  /** Marks a request accepted and creates (or revives) the pair's match. Returns the match id. */
  private async acceptRequest(id: string, senderId: string, recipientId: string): Promise<string> {
    const [userAId, userBId] = ordered(senderId, recipientId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.connectionRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      if (updated.count !== 1) throw new NotFoundException(NOT_FOUND);
      const match = await tx.match.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        create: { userAId, userBId, connectionRequestId: id },
        update: { connectionRequestId: id, endedAt: null, createdAt: new Date() },
      });
      await MessagingService.openConversation(tx, match.id, userAId, userBId);
      return match.id;
    });
  }

  async accept(recipientId: string, id: string, requestId: string): Promise<{ matchId: string }> {
    const request = await this.prisma.connectionRequest.findFirst({
      where: { id, recipientId, status: 'PENDING' },
    });
    if (!request) throw new NotFoundException(NOT_FOUND);
    if (await this.people.isBlocked(request.senderId, recipientId))
      throw new NotFoundException(NOT_FOUND);
    const matchId = await this.acceptRequest(id, request.senderId, recipientId);
    await this.event(recipientId, request.senderId, 'CONNECTION_ACCEPTED');
    this.messaging.connectionChanged([recipientId, request.senderId]);
    await this.notifications.notify(request.senderId, {
      kind: 'connected',
      fromUserId: recipientId,
    });
    await this.audit.record({
      action: 'connections.accepted',
      actorId: recipientId,
      entityType: 'match',
      entityId: matchId,
      requestId,
    });
    return { matchId };
  }

  async decline(recipientId: string, id: string): Promise<void> {
    const updated = await this.prisma.connectionRequest.updateMany({
      where: { id, recipientId, status: 'PENDING' },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    if (updated.count !== 1) throw new NotFoundException(NOT_FOUND);
    const request = await this.prisma.connectionRequest.findUniqueOrThrow({ where: { id } });
    await this.event(recipientId, request.senderId, 'CONNECTION_DECLINED');
    this.messaging.connectionChanged([recipientId, request.senderId]);
  }

  async withdraw(senderId: string, id: string): Promise<void> {
    const updated = await this.prisma.connectionRequest.updateMany({
      where: { id, senderId, status: 'PENDING' },
      data: { status: 'WITHDRAWN', respondedAt: new Date() },
    });
    if (updated.count !== 1) throw new NotFoundException(NOT_FOUND);
    const request = await this.prisma.connectionRequest.findUniqueOrThrow({ where: { id } });
    this.messaging.connectionChanged([senderId, request.recipientId]);
  }

  async endMatch(userId: string, matchId: string, requestId: string): Promise<void> {
    const updated = await this.prisma.match.updateMany({
      where: { id: matchId, endedAt: null, OR: [{ userAId: userId }, { userBId: userId }] },
      data: { endedAt: new Date() },
    });
    if (updated.count !== 1) throw new NotFoundException(NOT_FOUND);
    const match = await this.prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    this.messaging.connectionChanged([match.userAId, match.userBId]);
    await this.audit.record({
      action: 'connections.ended',
      actorId: userId,
      entityType: 'match',
      entityId: matchId,
      requestId,
    });
  }

  async relationship(viewerId: string, targetId: string): Promise<RelationshipState> {
    await this.requireVisible(viewerId, targetId);
    const [low, high] = ordered(viewerId, targetId);
    const [saved, outgoing, incoming, match, pendingCount] = await Promise.all([
      this.prisma.savedProfile.count({ where: { userId: viewerId, targetUserId: targetId } }),
      this.prisma.connectionRequest.findUnique({
        where: { senderId_recipientId: { senderId: viewerId, recipientId: targetId } },
      }),
      this.prisma.connectionRequest.findUnique({
        where: { senderId_recipientId: { senderId: targetId, recipientId: viewerId } },
      }),
      this.prisma.match.findFirst({ where: { userAId: low, userBId: high, endedAt: null } }),
      this.prisma.connectionRequest.count({ where: { senderId: viewerId, status: 'PENDING' } }),
    ]);
    const declinedRecently =
      outgoing?.status === 'DECLINED' &&
      outgoing.respondedAt !== null &&
      Date.now() - outgoing.respondedAt.getTime() < DECLINE_COOLDOWN_DAYS * DAY_MS;
    return {
      saved: saved > 0,
      outgoingRequestId: outgoing?.status === 'PENDING' ? outgoing.id : null,
      incomingRequestId: incoming?.status === 'PENDING' ? incoming.id : null,
      matchId: match?.id ?? null,
      conversationId: match ? await this.messaging.conversationForMatch(match.id) : null,
      requestBlockedReason: declinedRecently
        ? 'declined_recently'
        : pendingCount >= MAX_PENDING_OUTGOING
          ? 'too_many_pending'
          : null,
    };
  }

  async list(userId: string): Promise<Connections> {
    const [incoming, outgoing, matches, saved] = await Promise.all([
      this.prisma.connectionRequest.findMany({
        where: { recipientId: userId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.connectionRequest.findMany({
        where: { senderId: userId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.match.findMany({
        where: { endedAt: null, OR: [{ userAId: userId }, { userBId: userId }] },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.savedProfile.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    const ids = new Set<string>([
      ...incoming.map((r) => r.senderId),
      ...outgoing.map((r) => r.recipientId),
      ...matches.map((m) => (m.userAId === userId ? m.userBId : m.userAId)),
      ...saved.map((s) => s.targetUserId),
    ]);
    const summaries = await this.compatibility.summaries(userId, [...ids]);
    const conversations = new Map<string, string>();
    for (const m of matches)
      conversations.set(m.id, await this.messaging.conversationForMatch(m.id));
    const item = (
      id: string | null,
      personId: string,
      note: string | null,
      createdAt: Date,
      conversationId: string | null = null,
    ): ConnectionItem[] => {
      const person = summaries.get(personId);
      return person
        ? [{ id, person, note, createdAt: createdAt.toISOString(), conversationId }]
        : [];
    };
    // Saved people must still be visible (they may have hidden or changed their preferences since).
    const visibleSaved = [];
    for (const s of saved)
      if (await this.people.visiblePair(userId, s.targetUserId)) visibleSaved.push(s);
    return {
      incoming: incoming.flatMap((r) => item(r.id, r.senderId, r.note, r.createdAt)),
      outgoing: outgoing.flatMap((r) => item(r.id, r.recipientId, r.note, r.createdAt)),
      mutual: matches.flatMap((m) =>
        item(
          m.id,
          m.userAId === userId ? m.userBId : m.userAId,
          null,
          m.createdAt,
          conversations.get(m.id) ?? null,
        ),
      ),
      saved: visibleSaved.flatMap((s) => item(null, s.targetUserId, null, s.createdAt)),
    };
  }

  // ─────────────────────────── blocks ───────────────────────────

  /**
   * Blocking ends everything between two people at once: the match, pending
   * requests both ways and saves both ways. Each disappears from the other's
   * discovery, profiles and connections.
   */
  async block(blockerId: string, blockedId: string, requestId: string): Promise<void> {
    if (blockerId === blockedId) throw new BadRequestException('You can’t block yourself.');
    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { status: true },
    });
    if (!target || target.status === 'DELETED') throw new NotFoundException(NOT_FOUND);
    const [low, high] = ordered(blockerId, blockedId);
    const pair = [
      { senderId: blockerId, recipientId: blockedId },
      { senderId: blockedId, recipientId: blockerId },
    ];
    await this.prisma.$transaction([
      this.prisma.blockedUser.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      }),
      this.prisma.match.updateMany({
        where: { userAId: low, userBId: high, endedAt: null },
        data: { endedAt: new Date() },
      }),
      this.prisma.connectionRequest.updateMany({
        where: { status: 'PENDING', OR: pair },
        data: { status: 'EXPIRED', respondedAt: new Date() },
      }),
      this.prisma.savedProfile.deleteMany({
        where: {
          OR: [
            { userId: blockerId, targetUserId: blockedId },
            { userId: blockedId, targetUserId: blockerId },
          ],
        },
      }),
    ]);
    this.messaging.connectionChanged([blockerId, blockedId]);
    await this.audit.record({
      action: 'safety.blocked',
      actorId: blockerId,
      entityType: 'user',
      entityId: blockedId,
      requestId,
    });
  }

  async unblock(blockerId: string, blockedId: string, requestId: string): Promise<void> {
    const removed = await this.prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } });
    if (removed.count === 0) throw new NotFoundException(NOT_FOUND);
    await this.audit.record({
      action: 'safety.unblocked',
      actorId: blockerId,
      entityType: 'user',
      entityId: blockedId,
      requestId,
    });
  }

  /** People the viewer has blocked: names only, no photos. */
  async blocked(
    blockerId: string,
  ): Promise<{ userId: string; displayName: string; blockedAt: string }[]> {
    const rows = await this.prisma.blockedUser.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { select: { profile: { select: { displayName: true } } } } },
    });
    return rows.map((r) => ({
      userId: r.blockedId,
      displayName: r.blocked.profile?.displayName ?? 'Someone',
      blockedAt: r.createdAt.toISOString(),
    }));
  }
}
