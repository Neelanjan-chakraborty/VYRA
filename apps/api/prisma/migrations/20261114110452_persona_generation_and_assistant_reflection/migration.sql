-- AlterEnum
ALTER TYPE "EvidenceSourceType" ADD VALUE 'ASSISTANT_REFLECTION';

-- AlterTable
ALTER TABLE "persona_evidence" ADD COLUMN     "source_detail" VARCHAR(40);

-- AlterTable
ALTER TABLE "personas" ADD COLUMN     "generation_failure_code" VARCHAR(60),
ADD COLUMN     "generation_requested_at" TIMESTAMPTZ(3),
ADD COLUMN     "generation_status" VARCHAR(20) NOT NULL DEFAULT 'idle';

-- Generation state is one of a fixed set.
ALTER TABLE "personas" ADD CONSTRAINT "personas_generation_status_valid"
  CHECK ("generation_status" IN ('idle', 'queued', 'generating', 'ready', 'failed'));
