import { randomBytes } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { LearningSample } from '@vyra/engine-native';
import {
  COMPATIBILITY_DIMENSIONS,
  compatibilityWeightsSchema,
  type FitResult,
  fitMetricsSchema,
  type WeightSetView,
} from '@vyra/validation';
import type { Queue } from 'bullmq';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../database/prisma.service.js';
import { type CompatibilityWeightSet, Prisma } from '../../generated/prisma/client.js';
import { LEARNING_QUEUE } from '../../queue/queue.module.js';
import { AuditService } from '../audit/audit.service.js';
import { CompatibilityService } from '../compatibility/compatibility.service.js';
import { ENGINE, type Engine } from '../compatibility/engine.js';

/** Most recent decisions only, and a cap so a fit stays fast. */
const LOOKBACK_DAYS = 180;
const MAX_SAMPLES = 50_000;

/**
 * Learns proposed dimension weights from what people did with the people they
 * were shown, using the Rust engine's guarded logistic regression. A proposal
 * changes nothing until an admin approves it. Only the six dimension scores
 * and a yes/no outcome per decision are used — no identities leave the query.
 */
@Injectable()
export class LearningService implements OnModuleInit {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly compatibility: CompatibilityService,
    private readonly audit: AuditService,
    @Inject(ENGINE) private readonly engine: Engine,
    @Inject(ENV) private readonly env: Env,
    @InjectQueue(LEARNING_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.env.NODE_ENV === 'test') return;
    // Every Monday at 03:17 server time; a proposal then waits for an admin.
    await this.queue
      .upsertJobScheduler('weekly-fit', { pattern: '17 3 * * 1' }, { name: 'fit' })
      .catch((error: Error) =>
        this.logger.warn(`Could not schedule weight learning: ${error.message}`),
      );
  }

  /**
   * One sample per (viewer, candidate): their latest decisive action, paired
   * with the pair's most recent stored dimension scores.
   */
  async samples(): Promise<LearningSample[]> {
    const rows = await this.prisma.$queryRaw<{ positive: boolean; dimensions: unknown }[]>`
      with decisions as (
        select distinct on (e.user_id, e.target_user_id)
          e.user_id, e.target_user_id, e.type
        from discovery_events e
        where e.target_user_id is not null
          and e.type in ('SAVED', 'CONNECT_REQUESTED', 'CONNECTION_ACCEPTED', 'PASSED', 'CONNECTION_DECLINED')
          and e.created_at > now() - make_interval(days => ${LOOKBACK_DAYS})
        order by e.user_id, e.target_user_id, e.created_at desc
      )
      select d.type in ('SAVED', 'CONNECT_REQUESTED', 'CONNECTION_ACCEPTED') as positive,
             s.dimensions
      from decisions d
      join lateral (
        select cs.dimensions from compatibility_scores cs
        where cs.user_a_id = least(d.user_id, d.target_user_id)
          and cs.user_b_id = greatest(d.user_id, d.target_user_id)
        order by cs.computed_at desc
        limit 1
      ) s on true
      limit ${MAX_SAMPLES}`;
    return rows.map((row) => {
      const dimensions = (row.dimensions ?? {}) as Record<string, { score?: number | null }>;
      return {
        positive: row.positive,
        scores: COMPATIBILITY_DIMENSIONS.map((d) => {
          const score = dimensions[d]?.score;
          return typeof score === 'number' ? score : null;
        }),
      };
    });
  }

  async fit(actorId: string | null, requestId: string | null): Promise<FitResult> {
    if (!this.engine.fitWeights)
      throw new ServiceUnavailableException('Weight learning needs the Rust engine.');
    const current = await this.compatibility.activeWeights();
    const samples = await this.samples();
    const outcome = this.engine.fitWeights(samples, current.weights, {
      minSamples: this.env.LEARNING_MIN_SAMPLES,
      minPerClass: this.env.LEARNING_MIN_PER_CLASS,
      l2: 0.01,
      iterations: 2000,
      learningRate: 0.5,
    });
    let version: string | null = null;
    if (outcome.status === 'proposed' && outcome.weights) {
      const stamp = new Date().toISOString().slice(0, 19).replaceAll(/[-:T]/g, '');
      version = `learned-${stamp}-${randomBytes(2).toString('hex')}`;
      await this.prisma.compatibilityWeightSet.create({
        data: {
          version,
          weights: compatibilityWeightsSchema.parse(outcome.weights),
          status: 'PROPOSED',
          isActive: false,
          basedOn: current.version,
          metrics: outcome.metrics
            ? (outcome.metrics as unknown as Prisma.InputJsonObject)
            : Prisma.DbNull,
          notes: 'Learned from discovery decisions; waiting for review.',
        },
      });
    }
    await this.audit.record({
      action: 'weights.fit',
      actorId,
      entityType: 'weight_set',
      ...(version ? { entityId: version } : {}),
      metadata: { status: outcome.status, samples: samples.length },
      ...(requestId ? { requestId } : {}),
    });
    return { status: outcome.status, version, metrics: outcome.metrics };
  }

  private view(row: CompatibilityWeightSet): WeightSetView {
    return {
      version: row.version,
      weights: compatibilityWeightsSchema.parse(row.weights),
      status: row.status,
      isActive: row.isActive,
      basedOn: row.basedOn,
      metrics: row.metrics ? fitMetricsSchema.parse(row.metrics) : null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
    };
  }

  async list(): Promise<WeightSetView[]> {
    const rows = await this.prisma.compatibilityWeightSet.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.view(row));
  }

  /** Makes a proposal the active weights. Only PROPOSED sets can be approved. */
  async approve(version: string, adminId: string, requestId: string): Promise<WeightSetView> {
    const row = await this.prisma.$transaction(async (tx) => {
      const proposal = await tx.compatibilityWeightSet.findUnique({ where: { version } });
      if (!proposal) throw new NotFoundException('Not found.');
      if (proposal.status !== 'PROPOSED') throw new ConflictException('Already decided.');
      await tx.compatibilityWeightSet.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return tx.compatibilityWeightSet.update({
        where: { version },
        data: { status: 'APPROVED', isActive: true, decidedById: adminId, decidedAt: new Date() },
      });
    });
    this.compatibility.invalidateWeights();
    await this.audit.record({
      action: 'weights.approved',
      actorId: adminId,
      entityType: 'weight_set',
      entityId: version,
      requestId,
    });
    return this.view(row);
  }

  async reject(version: string, adminId: string, requestId: string): Promise<WeightSetView> {
    const updated = await this.prisma.compatibilityWeightSet.updateMany({
      where: { version, status: 'PROPOSED' },
      data: { status: 'REJECTED', decidedById: adminId, decidedAt: new Date() },
    });
    if (updated.count !== 1) throw new NotFoundException('Not found.');
    await this.audit.record({
      action: 'weights.rejected',
      actorId: adminId,
      entityType: 'weight_set',
      entityId: version,
      requestId,
    });
    return this.view(
      await this.prisma.compatibilityWeightSet.findUniqueOrThrow({ where: { version } }),
    );
  }
}
