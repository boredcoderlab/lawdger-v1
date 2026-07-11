import { Prisma } from "@prisma/client";
import { startOfTodayIST } from "@/lib/date";

/**
 * Recomputes Case.nextHearingDate from CalendarEvent rows and writes the
 * cache column. CalendarEvent is the source of truth; this is the only
 * writer of Case.nextHearingDate. Call after any CalendarEvent create,
 * update, or delete that could change which event is soonest — inside the
 * same transaction as that mutation.
 */
export async function syncNextHearingDate(
  caseId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const nextEvent = await tx.calendarEvent.findFirst({
    where: { caseId, hearingDate: { gte: startOfTodayIST() } },
    orderBy: { hearingDate: "asc" },
  });

  await tx.case.update({
    where: { id: caseId },
    data: { nextHearingDate: nextEvent?.hearingDate ?? null },
  });
}
