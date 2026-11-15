-- The chat theme is shared by both people in a conversation.
-- Per-person choices were cosmetic and are not carried over.
ALTER TABLE "conversation_participants" DROP CONSTRAINT "conversation_participants_theme_format";
ALTER TABLE "conversation_participants" DROP COLUMN "theme";

ALTER TABLE "conversations" ADD COLUMN "theme" VARCHAR(20) NOT NULL DEFAULT 'default';
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_theme_format"
  CHECK ("theme" ~ '^[a-z]{1,20}$');
