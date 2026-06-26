"use server";

import { requireUserId } from "@/actions/requireUserId";
import { withServerUserContext } from "@/lib/session";
import { startOfTodayIST, endOfTodayIST } from "@/lib/date";

export async function getDashboardData() {
  const userId = await requireUserId();

  return withServerUserContext(async (tx) => {
    const todayEvents = await tx.calendarEvent.findMany({
      where: { userId, hearingDate: { gte: startOfTodayIST(), lte: endOfTodayIST() } },
      include: { case: { select: { id: true, title: true } } },
      orderBy: { hearingDate: "asc" },
    });

    const upcomingEvents = await tx.calendarEvent.findMany({
      where: { userId, hearingDate: { gt: endOfTodayIST() } },
      include: { case: { select: { id: true, title: true } } },
      orderBy: { hearingDate: "asc" },
      take: 7,
    });

    const pendingTasks = await tx.task.findMany({
      where: { userId, status: "pending" },
      include: { case: { select: { id: true, title: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 10,
    });

    const allCases = await tx.case.findMany({
      where: { userId },
      select: { id: true, title: true, clientName: true, status: true },
      orderBy: { updatedAt: "desc" },
    });

    const now = new Date();
    // CalendarEvent.caseId is non-nullable in schema — every event belongs to a case.
    const nextHearings = await tx.calendarEvent.groupBy({
      by: ["caseId"],
      where: { userId, hearingDate: { gte: now } },
      _min: { hearingDate: true },
    });
    const nextHearingByCase = new Map<string, Date>();
    for (const r of nextHearings) {
      const min = r._min?.hearingDate;
      if (min) nextHearingByCase.set(r.caseId, min);
    }
    const allCasesWithNext = allCases.map((c) => ({
      ...c,
      nextHearingDate: nextHearingByCase.get(c.id) ?? null,
    }));

    const totalCases = await tx.case.count({ where: { userId, status: "ACTIVE" } });
    const totalTasks = await tx.task.count({ where: { userId, status: "pending" } });

    return {
      todayEvents,
      upcomingEvents,
      pendingTasks,
      allCases: allCasesWithNext,
      totalCases,
      totalTasks,
    };
  });
}
