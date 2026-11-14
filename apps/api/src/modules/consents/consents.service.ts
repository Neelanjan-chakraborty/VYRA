import { Injectable } from '@nestjs/common';
import {
  CURRENT_AI_NOTICE_VERSION,
  TOGGLEABLE_CONSENTS,
  type ConsentState,
  type ToggleableConsent,
} from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import type { ConsentType } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';

/** Consents whose withdrawal discards unapproved AI output straight away. */
const AI_CONSENTS: readonly ToggleableConsent[] = ['AI_PERSONA_PROCESSING', 'AI_IMPORT_PROCESSING'];

@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async hasConsent(userId: string, type: ConsentType): Promise<boolean> {
    const active = await this.prisma.userConsent.count({
      where: { userId, type, revokedAt: null },
    });
    return active > 0;
  }

  async list(userId: string): Promise<ConsentState[]> {
    const active = await this.prisma.userConsent.findMany({
      where: { userId, revokedAt: null, type: { in: [...TOGGLEABLE_CONSENTS] } },
      orderBy: { grantedAt: 'desc' },
    });
    return TOGGLEABLE_CONSENTS.map((type) => {
      const row = active.find((consent) => consent.type === type);
      return {
        type,
        granted: row !== undefined,
        policyVersion: row?.policyVersion ?? null,
        grantedAt: row?.grantedAt.toISOString() ?? null,
      };
    });
  }

  /** Append-only: granting adds a row, withdrawing stamps the active one. */
  async set(
    userId: string,
    type: ToggleableConsent,
    granted: boolean,
    requestId: string,
  ): Promise<ConsentState[]> {
    const already = await this.hasConsent(userId, type);
    if (granted && !already) {
      await this.prisma.userConsent.create({
        data: { userId, type, policyVersion: CURRENT_AI_NOTICE_VERSION },
      });
      await this.audit.record({
        action: 'consent.granted',
        actorId: userId,
        entityType: 'consent',
        entityId: type,
        requestId,
      });
    }
    if (!granted && already) {
      await this.prisma.userConsent.updateMany({
        where: { userId, type, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (AI_CONSENTS.includes(type)) await this.discardUnapprovedAiOutput(userId);
      await this.audit.record({
        action: 'consent.revoked',
        actorId: userId,
        entityType: 'consent',
        entityId: type,
        requestId,
      });
    }
    return this.list(userId);
  }

  /** Withdrawing AI consent deletes drafts at once; an approved persona stays until cleared. */
  private async discardUnapprovedAiOutput(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.personaVersion.deleteMany({ where: { status: 'DRAFT', persona: { userId } } }),
      this.prisma.persona.updateMany({
        where: { userId },
        data: { generationStatus: 'idle', generationFailureCode: null },
      }),
    ]);
  }
}
