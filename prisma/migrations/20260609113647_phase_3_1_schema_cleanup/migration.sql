-- Remap legacy status string values to new enum domain
-- Any non-CLOSED value collapses to ACTIVE per Phase 3 lock.
-- No-op on current data (all rows already 'active') but kept as intent + drift guard.
UPDATE "Case" SET status = 'active' WHERE status NOT IN ('active', 'closed');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "MatterType" AS ENUM ('LITIGATION', 'ADVISORY', 'PRE_LITIGATION');

-- AlterTable: drop legacy fields, add caseNumber + matterType
ALTER TABLE "Case" DROP COLUMN "courtName",
DROP COLUMN "forum",
DROP COLUMN "matterId",
ADD COLUMN     "caseNumber" TEXT,
ADD COLUMN     "matterType" "MatterType" NOT NULL DEFAULT 'LITIGATION';

-- AlterTable: convert status TEXT -> CaseStatus enum, preserving data via USING
-- Existing index Case_status_idx is rebuilt by Postgres automatically.
ALTER TABLE "Case"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CaseStatus" USING (UPPER("status")::"CaseStatus"),
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
