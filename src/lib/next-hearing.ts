import { Prisma } from "@prisma/client";

/**
 * Live "next hearing date" per case, derived from CalendarEvent (the source of
 * truth) instead of the former Case.nextHearingDate cache column (W9 PR2).
 *
 * For each caseId, returns the soonest hearingDate that is >= `now`, or null if
 * the case has no future hearing. Absent-from-map is equivalent to null.
 *
 * `now` MUST be the same floor the old cache pipeline used — `startOfTodayIST()`
 * — NOT the current instant. The floor keeps all-day events (stored at IST
 * midnight = 18:30 UTC prev day) visible through the whole IST day (N49), and
 * makes the result byte-identical to the old `filterStalePastHearing(cache)`
 * path when the cache was in sync. Because the query itself filters `>= now`,
 * the result can never be stale-past — no separate stale filter is needed.
 *
 * Must be called with an RLS-scoped client (a `withServerUserContext` tx or a
 * `getServerScopedPrisma()` client). Does NOT create its own client. A full
 * PrismaClient is assignable to `Prisma.TransactionClient`, so both callers fit.
 */
export async function getNextHearingDatesByCase(
  prisma: Prisma.TransactionClient,
  caseIds: string[],
  now: Date,
): Promise<Map<string, Date | null>> {
  const byCase = new Map<string, Date | null>();
  if (caseIds.length === 0) return byCase;

  const grouped = await prisma.calendarEvent.groupBy({
    by: ["caseId"],
    where: { caseId: { in: caseIds }, hearingDate: { gte: now } },
    _min: { hearingDate: true },
  });

  for (const g of grouped) {
    byCase.set(g.caseId, g._min.hearingDate ?? null);
  }
  return byCase;
}
