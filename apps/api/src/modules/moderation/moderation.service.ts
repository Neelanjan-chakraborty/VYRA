import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ModerationQueueItem } from '@vyra/validation';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  ModerationAction,
  PhotoModerationStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import { PHOTO_MODERATION_QUEUE } from '../../queue/queue.module.js';
import { AuditService } from '../audit/audit.service.js';
import { MediaUrlService } from '../storage/media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.js';
import { PHOTO_MODERATION_PROVIDER, type PhotoModerationProvider } from './provider.js';

const STATUS_ACTION: Readonly<Record<Exclude<PhotoModerationStatus, 'PENDING'>, ModerationAction>> =
  {
    APPROVED: 'PHOTO_APPROVED',
    REJECTED: 'PHOTO_REJECTED',
    REVIEW_REQUIRED: 'PHOTO_REVIEW_REQUIRED',
  };

/**
 * The photo moderation pipeline: automated first pass, human review for
 * anything uncertain, appealed or reported, and a full history in
 * moderation_events plus the audit log.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaUrlService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(PHOTO_MODERATION_PROVIDER) private readonly provider: PhotoModerationProvider,
    @InjectQueue(PHOTO_MODERATION_QUEUE) private readonly queue: Queue,
  ) {}

  /** Records a new or replaced upload and queues it for the automated pass. */
  async submit(photoId: string, ownerId: string): Promise<void> {
    await this.event(ownerId, null, 'PHOTO_SUBMITTED', photoId, null);
    await this.queue.add(
      'assess',
      { photoId },
      {
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }

  /** Worker entry point: automated assessment of whatever is stored now. */
  async assess(photoId: string): Promise<void> {
    const photo = await this.prisma.userPhoto.findUnique({ where: { id: photoId } });
    // Deleted, or already decided (e.g. replaced and re-queued, or a moderator was faster).
    if (!photo || photo.deletedAt || photo.moderationStatus !== 'PENDING') return;
    const data = await this.storage.get(photo.storageKey);
    if (!data) return;
    const result = await this.provider.assess(data);
    const status: PhotoModerationStatus =
      result.verdict === 'approve'
        ? 'APPROVED'
        : result.verdict === 'reject'
          ? 'REJECTED'
          : 'REVIEW_REQUIRED';
    // Only move a photo that is still the same upload and still pending.
    const updated = await this.prisma.userPhoto.updateMany({
      where: { id: photoId, contentHash: photo.contentHash, moderationStatus: 'PENDING' },
      data: { moderationStatus: status, moderationReason: result.reason, moderatedAt: new Date() },
    });
    if (updated.count === 0) return;
    await this.event(photo.userId, null, STATUS_ACTION[status], photoId, result.reason, {
      provider: this.provider.id,
      ...(result.scores ? { scores: result.scores } : {}),
    });
  }

  /** The owner asks a person to look at a rejection. Once per upload. */
  async appeal(ownerId: string, photoId: string): Promise<void> {
    const photo = await this.prisma.userPhoto.findFirst({
      where: { id: photoId, userId: ownerId, deletedAt: null },
    });
    if (!photo) throw new NotFoundException('Photo not found.');
    if (photo.moderationStatus !== 'REJECTED' || photo.appealRequestedAt) {
      throw new ConflictException('This photo can’t be sent for review.');
    }
    await this.prisma.userPhoto.update({
      where: { id: photoId },
      data: {
        moderationStatus: 'REVIEW_REQUIRED',
        moderationReason: 'appealed',
        appealRequestedAt: new Date(),
        moderatedAt: new Date(),
      },
    });
    await this.event(ownerId, ownerId, 'PHOTO_REVIEW_REQUIRED', photoId, 'appealed');
  }

  /** Moves a reported photo to human review (hiding it) once enough people report it. */
  async hideForReview(photoId: string, reason: string): Promise<void> {
    const photo = await this.prisma.userPhoto.findUnique({ where: { id: photoId } });
    if (
      !photo ||
      photo.deletedAt ||
      photo.moderationStatus === 'REVIEW_REQUIRED' ||
      photo.moderationStatus === 'REJECTED'
    )
      return;
    await this.prisma.userPhoto.update({
      where: { id: photoId },
      data: {
        moderationStatus: 'REVIEW_REQUIRED',
        moderationReason: reason,
        moderatedAt: new Date(),
      },
    });
    await this.event(photo.userId, null, 'PHOTO_REVIEW_REQUIRED', photoId, reason);
  }

  async queueForReview(limit = 50): Promise<ModerationQueueItem[]> {
    const photos = await this.prisma.userPhoto.findMany({
      where: { moderationStatus: 'REVIEW_REQUIRED', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    const reports = await this.prisma.safetyReport.groupBy({
      by: ['photoId'],
      where: { photoId: { in: photos.map((p) => p.id) }, status: { in: ['OPEN', 'IN_REVIEW'] } },
      _count: { _all: true },
    });
    const counts = new Map(reports.map((r) => [r.photoId, r._count._all]));
    return photos.map((p) => ({
      photoId: p.id,
      ownerId: p.userId,
      status: p.moderationStatus,
      reason: p.moderationReason,
      appealed: p.appealRequestedAt !== null,
      openReports: counts.get(p.id) ?? 0,
      createdAt: p.createdAt.toISOString(),
      url: this.media.sign(p.storageKey, 'moderator'),
    }));
  }

  /** A moderator's decision. Rejection removes the photo from every public surface at once. */
  async decide(
    moderatorId: string,
    photoId: string,
    decision: 'approve' | 'reject',
    reason: string,
    requestId: string,
  ): Promise<void> {
    const photo = await this.prisma.userPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.deletedAt) throw new NotFoundException('Photo not found.');
    const status: PhotoModerationStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';
    await this.prisma.$transaction([
      this.prisma.userPhoto.update({
        where: { id: photoId },
        data: { moderationStatus: status, moderationReason: reason, moderatedAt: new Date() },
      }),
      // Reports about this photo are resolved by the decision.
      this.prisma.safetyReport.updateMany({
        where: { photoId, status: { in: ['OPEN', 'IN_REVIEW'] } },
        data: {
          status: decision === 'reject' ? 'ACTIONED' : 'DISMISSED',
          resolvedById: moderatorId,
          resolvedAt: new Date(),
          resolutionNote: reason,
        },
      }),
    ]);
    await this.event(photo.userId, moderatorId, STATUS_ACTION[status], photoId, reason);
    await this.audit.record({
      action: `moderation.photo_${decision === 'approve' ? 'approved' : 'rejected'}`,
      actorId: moderatorId,
      entityType: 'photo',
      entityId: photoId,
      metadata: { reason },
      requestId,
    });
  }

  async event(
    subjectUserId: string,
    actorId: string | null,
    action: ModerationAction,
    photoId: string,
    reason: string | null,
    metadata?: Prisma.InputJsonObject,
  ): Promise<void> {
    try {
      await this.prisma.moderationEvent.create({
        data: { subjectUserId, actorId, action, targetType: 'photo', targetId: photoId, reason },
      });
      await this.audit.record({
        action: `photo.${action.toLowerCase()}`,
        actorId,
        entityType: 'photo',
        entityId: photoId,
        metadata: { ...(reason ? { reason } : {}), ...metadata },
      });
    } catch (error) {
      this.logger.error(
        'Could not record moderation event',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
