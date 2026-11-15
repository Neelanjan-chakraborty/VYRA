-- CreateEnum
CREATE TYPE "ScheduledMessageStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "restricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "theme" VARCHAR(20) NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "edited_at" TIMESTAMPTZ(3),
ADD COLUMN     "forwarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinned_at" TIMESTAMPTZ(3),
ADD COLUMN     "reply_to_id" UUID;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "default_read_receipts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "default_shares_typing" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_preview" VARCHAR(10) NOT NULL DEFAULT 'name';

-- CreateTable
CREATE TABLE "message_reactions" (
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("message_id","user_id")
);

-- CreateTable
CREATE TABLE "scheduled_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "send_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "ScheduledMessageStatus" NOT NULL DEFAULT 'PENDING',
    "message_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_messages_sender_id_status_idx" ON "scheduled_messages"("sender_id", "status");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_notify_preview_valid"
  CHECK ("notify_preview" IN ('name', 'hidden'));
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_theme_format"
  CHECK ("theme" ~ '^[a-z]{1,20}$');
-- A message can't reply to itself; editing is for text only.
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_not_self" CHECK ("reply_to_id" IS NULL OR "reply_to_id" <> "id");
ALTER TABLE "messages" ADD CONSTRAINT "messages_edit_text_only" CHECK ("edited_at" IS NULL OR "kind" = 'TEXT');
CREATE INDEX "messages_pinned_idx" ON "messages" ("conversation_id") WHERE "pinned_at" IS NOT NULL;
CREATE INDEX "scheduled_messages_pending_idx" ON "scheduled_messages" ("send_at") WHERE "status" = 'PENDING';
