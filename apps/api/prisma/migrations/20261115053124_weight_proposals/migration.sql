-- CreateEnum
CREATE TYPE "WeightSetStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "compatibility_weight_sets" ADD COLUMN     "based_on" VARCHAR(40),
ADD COLUMN     "decided_at" TIMESTAMPTZ(3),
ADD COLUMN     "decided_by_id" UUID,
ADD COLUMN     "metrics" JSONB,
ADD COLUMN     "status" "WeightSetStatus" NOT NULL DEFAULT 'APPROVED';

-- Only an approved weight set may be the active one.
ALTER TABLE "compatibility_weight_sets" ADD CONSTRAINT "compatibility_weight_sets_active_is_approved"
  CHECK (NOT "is_active" OR "status" = 'APPROVED');
-- At most one active weight set.
CREATE UNIQUE INDEX "compatibility_weight_sets_one_active" ON "compatibility_weight_sets" ("is_active") WHERE "is_active";
