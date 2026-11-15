-- CreateEnum
CREATE TYPE "MediaConsent" AS ENUM ('ASK', 'ALLOWED');

-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE 'VIDEO';

-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "media_consent" "MediaConsent" NOT NULL DEFAULT 'ASK';

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "disappear_seconds" INTEGER;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "allow_save" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "media_poster_key" TEXT,
ADD COLUMN     "media_preview_key" TEXT,
ADD COLUMN     "opened_at" TIMESTAMPTZ(3),
ADD COLUMN     "sensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timer_seconds" INTEGER,
ADD COLUMN     "view_once" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "blur_incoming_media" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "default_disappear_seconds" INTEGER,
ADD COLUMN     "default_media_consent" VARCHAR(10) NOT NULL DEFAULT 'ask';

-- CreateTable
CREATE TABLE "media_vault_items" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "thumb_key" TEXT,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "source_message_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_vault_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_vault_items_owner_id_created_at_idx" ON "media_vault_items"("owner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_vault_items_owner_id_source_message_id_key" ON "media_vault_items"("owner_id", "source_message_id");

-- CreateIndex
CREATE INDEX "messages_expires_idx" ON "messages"("expires_at");

-- AddForeignKey
ALTER TABLE "media_vault_items" ADD CONSTRAINT "media_vault_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written below (see the database-migrations skill).

-- Conversations that already exist keep showing media as they did; only new
-- conversations start from each person's default (ask first unless changed).
UPDATE "conversation_participants" SET "media_consent" = 'ALLOWED';

-- VIDEO is media too. kind::text: a value added to an enum in this migration
-- can't be compared as the enum yet.
ALTER TABLE "messages" DROP CONSTRAINT "messages_media_status_only_for_media";
ALTER TABLE "messages" ADD CONSTRAINT "messages_media_status_only_for_media"
  CHECK (("kind"::text IN ('IMAGE', 'VOICE', 'VIDEO')) = ("media_status" IS NOT NULL) OR "deleted_at" IS NOT NULL);
ALTER TABLE "messages" DROP CONSTRAINT "messages_voice_duration";
ALTER TABLE "messages" ADD CONSTRAINT "messages_media_duration"
  CHECK ("media_duration_ms" IS NULL
    OR ("kind"::text = 'VOICE' AND "media_duration_ms" BETWEEN 1 AND 60000)
    OR ("kind"::text = 'VIDEO' AND "media_duration_ms" BETWEEN 1 AND 30000));

-- Timers: a fixed set of choices. View once is for media and has no timer.
ALTER TABLE "messages" ADD CONSTRAINT "messages_timer_choices"
  CHECK ("timer_seconds" IS NULL OR "timer_seconds" IN (10, 30, 60, 3600, 86400));
ALTER TABLE "messages" ADD CONSTRAINT "messages_timer_kinds"
  CHECK ("timer_seconds" IS NULL OR "kind"::text IN ('TEXT', 'IMAGE', 'VIDEO'));
ALTER TABLE "messages" ADD CONSTRAINT "messages_view_once_media"
  CHECK (NOT "view_once" OR ("kind"::text IN ('IMAGE', 'VOICE', 'VIDEO') AND "timer_seconds" IS NULL));
ALTER TABLE "messages" ADD CONSTRAINT "messages_opened_protected"
  CHECK ("opened_at" IS NULL OR "view_once" OR "timer_seconds" IS NOT NULL);

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_disappear_choices"
  CHECK ("disappear_seconds" IS NULL OR "disappear_seconds" IN (86400, 604800, 7776000));
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_default_disappear_choices"
  CHECK ("default_disappear_seconds" IS NULL OR "default_disappear_seconds" IN (86400, 604800, 7776000));
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_default_media_consent_valid"
  CHECK ("default_media_consent" IN ('ask', 'allow'));

ALTER TABLE "media_vault_items" ADD CONSTRAINT "media_vault_items_bytes_positive" CHECK ("bytes" > 0);
ALTER TABLE "media_vault_items" ADD CONSTRAINT "media_vault_items_media_kind"
  CHECK ("kind"::text IN ('IMAGE', 'VOICE', 'VIDEO'));
