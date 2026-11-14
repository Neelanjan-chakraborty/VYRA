-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModerationAction" ADD VALUE 'PHOTO_SUBMITTED';
ALTER TYPE "ModerationAction" ADD VALUE 'PHOTO_REVIEW_REQUIRED';
ALTER TYPE "ModerationAction" ADD VALUE 'PHOTO_REPORTED';
ALTER TYPE "ModerationAction" ADD VALUE 'PHOTO_REMOVED';

-- AlterEnum
ALTER TYPE "PhotoModerationStatus" ADD VALUE 'REVIEW_REQUIRED';

-- AlterTable
ALTER TABLE "safety_reports" ADD COLUMN     "photo_id" UUID;

-- AlterTable
ALTER TABLE "user_photos" ADD COLUMN     "appeal_requested_at" TIMESTAMPTZ(3),
ADD COLUMN     "moderated_at" TIMESTAMPTZ(3),
ADD COLUMN     "moderation_reason" VARCHAR(60);

-- CreateIndex
CREATE INDEX "safety_reports_photo_id_idx" ON "safety_reports"("photo_id");

-- CreateIndex
CREATE INDEX "user_photos_moderation_status_created_at_idx" ON "user_photos"("moderation_status", "created_at");

-- A moderated status always records when it was decided.
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_moderated_consistent"
  CHECK ("moderation_status" IN ('PENDING') OR "moderated_at" IS NOT NULL);
