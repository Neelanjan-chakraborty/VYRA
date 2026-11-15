import { z } from 'zod';
import { photoModerationStatusSchema } from './me.js';

export const REPORT_REASONS = [
  'HARASSMENT',
  'INAPPROPRIATE_CONTENT',
  'FAKE_PROFILE',
  'UNDERAGE',
  'SPAM_OR_SCAM',
  'OFFLINE_SAFETY',
  'OTHER',
] as const;
export const reportReasonSchema = z.enum(REPORT_REASONS);

export const reportRequestSchema = z
  .object({
    reportedUserId: z.uuid(),
    reason: reportReasonSchema,
    details: z.string().trim().max(2000).optional(),
    photoId: z.uuid().optional(),
    /** A message the reporter received from the reported person. Hidden from the reporter at once. */
    messageId: z.uuid().optional(),
  })
  .refine((r) => !(r.photoId && r.messageId), 'Report a photo or a message, not both');
export type ReportRequest = z.infer<typeof reportRequestSchema>;

/** Distinct reporters after which a reported photo is hidden until a moderator decides. */
export const PHOTO_REPORT_HIDE_THRESHOLD = 2;

export const moderationQueueItemSchema = z.object({
  photoId: z.uuid(),
  ownerId: z.uuid(),
  status: photoModerationStatusSchema,
  reason: z.string().nullable(),
  appealed: z.boolean(),
  openReports: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  /** Short-lived URL scoped to moderators. */
  url: z.string(),
});
export const moderationQueueSchema = z.object({ items: z.array(moderationQueueItemSchema) });
export type ModerationQueueItem = z.infer<typeof moderationQueueItemSchema>;

export const moderationDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(1).max(60),
});
export type ModerationDecision = z.infer<typeof moderationDecisionSchema>;
