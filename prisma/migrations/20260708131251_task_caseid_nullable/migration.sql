-- Relax Task.caseId to nullable — enables Independent Tasks (no case association).
-- Product decision: Lawdger supports standalone tasks (admin, personal, non-matter work)
-- alongside case-linked tasks. See SOT N44/N45.
ALTER TABLE "Task" ALTER COLUMN "caseId" DROP NOT NULL;
