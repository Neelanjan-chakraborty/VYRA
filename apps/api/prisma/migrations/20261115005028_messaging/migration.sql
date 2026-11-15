-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- AlterEnum
ALTER TYPE "ConsentType" ADD VALUE 'WINGMAN';

-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "shares_typing" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "media_duration_ms" INTEGER,
ADD COLUMN     "media_height" INTEGER,
ADD COLUMN     "media_status" "PhotoModerationStatus",
ADD COLUMN     "media_width" INTEGER,
ADD COLUMN     "reported_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "notify_messages" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_requests" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "push_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");

-- CreateIndex
CREATE INDEX "push_devices_user_id_idx" ON "push_devices"("user_id");

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Media messages carry a moderation state; other kinds never do.
ALTER TABLE "messages" ADD CONSTRAINT "messages_media_status_only_for_media"
  CHECK (("kind" IN ('IMAGE', 'VOICE')) = ("media_status" IS NOT NULL) OR "deleted_at" IS NOT NULL);
-- Voice notes are at most a minute long; duration only on voice.
ALTER TABLE "messages" ADD CONSTRAINT "messages_voice_duration"
  CHECK ("media_duration_ms" IS NULL OR ("kind" = 'VOICE' AND "media_duration_ms" BETWEEN 1 AND 60000));
ALTER TABLE "messages" ADD CONSTRAINT "messages_media_dimensions_positive"
  CHECK (("media_width" IS NULL OR "media_width" > 0) AND ("media_height" IS NULL OR "media_height" > 0));
-- Unread checks and history paging read the newest messages of one conversation.
CREATE INDEX "messages_conversation_created_desc_idx" ON "messages" ("conversation_id", "created_at" DESC, "id" DESC);
