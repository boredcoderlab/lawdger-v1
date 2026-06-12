"use server";

import { requireUserId } from "@/actions/requireUserId";
import { withServerUserContext } from "@/lib/session";
import { startOfDay, endOfDay } from "date-fns";

export async function getDashboardData() {
  const userId = await requireUserId();
  const today = new Date();

  return withServerUserContext(async (tx) => {
    const todayEvents = await tx.calendarEvent.findMany({
      where: { userId, hearingDate: { gte: startOfDay(today), lte: endOfDay(today) } },
      include: { case: { select: { id: true, title: true } } },
      orderBy: { hearingDate: "asc" },
    });

    const upcomingEvents = await tx.calendarEvent.findMany({
      where: { userId, hearingDate: { gt: endOfDay(today) } },
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

    const totalCases = await tx.case.count({ where: { userId, status: "ACTIVE" } });
    const totalTasks = await tx.task.count({ where: { userId, status: "pending" } });

    return {
      todayEvents,
      upcomingEvents,
      pendingTasks,
      allCases,
      totalCases,
      totalTasks,
    };
  });
}
