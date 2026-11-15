import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PHOTO_REPORT_HIDE_THRESHOLD, type ReportRequest } from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ModerationService } from '../moderation/moderation.service.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Files a report. A photo report puts the photo in the moderation queue; once
   * PHOTO_REPORT_HIDE_THRESHOLD different people have reported it, it is
   * hidden until a moderator decides — so one person alone cannot hide
   * someone else's photos.
   */
  async create(reporterId: string, report: ReportRequest, requestId: string): Promise<void> {
    if (report.reportedUserId === reporterId)
      throw new BadRequestException('You can’t report yourself.');
    const reported = await this.prisma.user.findUnique({
      where: { id: report.reportedUserId },
      select: { status: true },
    });
    if (!reported || reported.status === 'DELETED') throw new NotFoundException('Not found.');
    if (report.photoId) {
      const photo = await this.prisma.userPhoto.count({
        where: { id: report.photoId, userId: report.reportedUserId, deletedAt: null },
      });
      if (photo === 0) throw new NotFoundException('Not found.');
    }
    if (report.messageId) {
      // Only a message you received, from the person you're reporting.
      const message = await this.prisma.message.count({
        where: {
          id: report.messageId,
          senderId: report.reportedUserId,
          deletedAt: null,
          conversation: { participants: { some: { userId: reporterId } } },
        },
      });
      if (message === 0) throw new NotFoundException('Not found.');
      await this.prisma.message.update({
        where: { id: report.messageId },
        data: { reportedAt: new Date() },
      });
    }

    const duplicate = await this.prisma.safetyReport.count({
      where: {
        reporterId,
        reportedUserId: report.reportedUserId,
        photoId: report.photoId ?? null,
        messageId: report.messageId ?? null,
        status: { in: ['OPEN', 'IN_REVIEW'] },
      },
    });
    if (duplicate === 0) {
      await this.prisma.safetyReport.create({
        data: {
          reporterId,
          reportedUserId: report.reportedUserId,
          reason: report.reason,
          details: report.details ?? null,
          photoId: report.photoId ?? null,
          messageId: report.messageId ?? null,
        },
      });
      await this.audit.record({
        action: 'safety.report_filed',
        actorId: reporterId,
        entityType: 'user',
        entityId: report.reportedUserId,
        metadata: {
          reason: report.reason,
          photo: report.photoId !== undefined,
          message: report.messageId !== undefined,
        },
        requestId,
      });
    }

    if (report.photoId) {
      if (duplicate === 0)
        await this.moderation.event(
          report.reportedUserId,
          reporterId,
          'PHOTO_REPORTED',
          report.photoId,
          report.reason.toLowerCase(),
        );
      const reporters = await this.prisma.safetyReport.findMany({
        where: { photoId: report.photoId, status: { in: ['OPEN', 'IN_REVIEW'] } },
        distinct: ['reporterId'],
        select: { reporterId: true },
      });
      if (reporters.length >= PHOTO_REPORT_HIDE_THRESHOLD)
        await this.moderation.hideForReview(report.photoId, 'reported');
    }
  }
}
