-- prisma/migrations/20260619230018_add_task_is_urgent/migration.sql
ALTER TABLE "Task" ADD COLUMN "isUrgent" BOOLEAN NOT NULL DEFAULT false;
