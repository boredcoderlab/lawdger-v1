-- DropColumn: W9 PR2 drops the Case.nextHearingDate cache column.
-- CalendarEvent is now the sole source of truth; the value is derived live per
-- request via getNextHearingDatesByCase (groupBy _min(hearingDate) >= IST-today),
-- backed by the CalendarEvent(caseId, hearingDate) composite index added in the
-- CP-1 migration. All readers (listCases, getCaseWithChildren, getDashboardData)
-- were migrated off the column, its writer (calendar-sync.ts) and stale-past
-- filters were deleted, in prior CP commits on this branch.
ALTER TABLE "Case" DROP COLUMN "nextHearingDate";
