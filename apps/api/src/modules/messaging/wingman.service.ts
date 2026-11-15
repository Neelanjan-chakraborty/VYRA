import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  WINGMAN_CONTEXT_MESSAGES,
  type WingmanPurpose,
  type WingmanSuggestions,
} from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import { AI_PROVIDER, type AiProvider, type WingmanContext } from '../ai/ai-provider.js';
import { filterWingmanSuggestions } from '../ai/prompt.js';
import { AuditService } from '../audit/audit.service.js';
import { CompatibilityService } from '../compatibility/compatibility.service.js';
import { ConsentsService } from '../consents/consents.service.js';
import { MessagingService } from './messaging.service.js';

const firstName = (name: string | undefined) => (name ?? '').trim().split(/\s+/)[0] || 'them';

/**
 * Optional help writing a message. It only ever suggests: the person edits
 * and sends it themselves. It sees what both people already show each other
 * and the compatibility reasons; recent messages only when the person asking
 * switched that on for this conversation and consented to it.
 */
@Injectable()
export class WingmanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly compatibility: CompatibilityService,
    private readonly consents: ConsentsService,
    private readonly audit: AuditService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  async suggest(
    userId: string,
    conversationId: string,
    purpose: WingmanPurpose,
    requestId: string,
  ): Promise<WingmanSuggestions> {
    if (!(await this.consents.hasConsent(userId, 'WINGMAN')))
      throw new ConflictException('Turn on Wingman first.');
    const access = await this.messaging.writable(userId, conversationId);
    const useMessages =
      access.me.wingmanContextEnabled &&
      (await this.consents.hasConsent(userId, 'WINGMAN_MESSAGE_CONTEXT'));

    const [profiles, interests, reasons, recent] = await Promise.all([
      this.prisma.userProfile.findMany({
        where: { userId: { in: [userId, access.otherId] } },
        select: { userId: true, displayName: true, bio: true, occupation: true },
      }),
      this.prisma.userInterest.findMany({
        where: { userId: { in: [userId, access.otherId] } },
        select: { userId: true, interest: { select: { label: true } } },
      }),
      this.compatibility.reasonsFor(userId, access.otherId),
      useMessages
        ? this.prisma.message.findMany({
            // Never self-destructing text, nor anything past its time.
            where: {
              conversationId,
              kind: 'TEXT',
              deletedAt: null,
              reportedAt: null,
              timerSeconds: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: WINGMAN_CONTEXT_MESSAGES,
            select: { senderId: true, body: true },
          })
        : Promise.resolve(null),
    ]);
    const me = profiles.find((p) => p.userId === userId);
    const them = profiles.find((p) => p.userId === access.otherId);
    const labels = (id: string) =>
      interests.filter((i) => i.userId === id).map((i) => i.interest.label);

    const context: WingmanContext = {
      purpose,
      me: { name: firstName(me?.displayName), interests: labels(userId) },
      // Only what the other person shows on their profile.
      them: {
        name: firstName(them?.displayName),
        bio: them?.bio ?? null,
        occupation: them?.occupation ?? null,
        interests: labels(access.otherId),
      },
      sharedInterests: reasons.sharedInterests,
      highlights: reasons.highlights,
      messages: recent
        ? recent.toReversed().map((m) => ({ fromMe: m.senderId === userId, text: m.body ?? '' }))
        : null,
    };

    let suggestions: string[] = [];
    try {
      suggestions = filterWingmanSuggestions(await this.ai.suggestMessages(context));
    } catch {
      suggestions = [];
    }
    await this.audit.record({
      action: 'wingman.suggested',
      actorId: userId,
      entityType: 'conversation',
      entityId: conversationId,
      metadata: {
        purpose,
        usedMessages: useMessages,
        count: suggestions.length,
        provider: this.ai.id,
      },
      requestId,
    });
    return { suggestions, usedMessages: useMessages };
  }
}
