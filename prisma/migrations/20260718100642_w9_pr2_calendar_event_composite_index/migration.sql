-- CreateIndex: W9 PR2 purpose-built composite for the live nextHearingDate read.
-- Backs the groupBy({ by: ['caseId'], where: { caseId: { in }, hearingDate: { gte: now } },
-- _min: { hearingDate } }) that replaces the dropped Case.nextHearingDate cache column.
-- Leading caseId supports the IN-list filter + grouping; trailing hearingDate lets Postgres
-- resolve both the gte range and the _min without a separate sort.
CREATE INDEX IF NOT EXISTS "CalendarEvent_caseId_hearingDate_idx"
  ON "CalendarEvent"("caseId", "hearingDate");
