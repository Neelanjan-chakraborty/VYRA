-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "media_alt_key" TEXT,
ADD COLUMN     "media_bytes" INTEGER,
ADD COLUMN     "media_thumb_key" TEXT;

-- AlterTable
ALTER TABLE "user_photos" ADD COLUMN     "thumb_key" TEXT;

ALTER TABLE "messages" ADD CONSTRAINT "messages_media_bytes_positive" CHECK ("media_bytes" IS NULL OR "media_bytes" > 0);
