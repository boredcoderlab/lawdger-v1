-- prisma/migrations/20260622000000_phase_4_b_auto_event_pipeline/migration.sql
-- Phase 4 Pillar B — additive nullable columns for auto-event pipeline.
-- Note.nextDate     : optional ISO date captured when category="Next Date".
-- CalendarEvent.noteId : optional one-to-one link back to the source Note;
--                        nullable so existing events (with no source note) keep working.

ALTER TABLE "Note" ADD COLUMN "nextDate" TIMESTAMP(3);
ALTER TABLE "CalendarEvent" ADD COLUMN "noteId" TEXT;
CREATE UNIQUE INDEX "CalendarEvent_noteId_key" ON "CalendarEvent"("noteId");
