import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

export interface AuditEntry {
  readonly action: string;
  readonly actorId?: string | null;
  readonly entityType?: string;
  readonly entityId?: string;
  /** Ids, codes and counts only — never content, contact details or credentials. */
  readonly metadata?: Prisma.InputJsonObject;
  readonly requestId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records a security-relevant event. A failure to record never breaks the request. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? null,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata ?? {},
          requestId: entry.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not write audit entry "${entry.action}"`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
