"use server";

import { requireUserId } from "@/actions/requireUserId";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";

export async function getDashboardData() {
  const userId = await requireUserId();
  const today = new Date();

  const [
    todayEvents,
    upcomingEvents,
    pendingTasks,
    allCases,
    totalCases,
    totalTasks,
  ] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { userId, hearingDate: { gte: startOfDay(today), lte: endOfDay(today) } },
      include: { case: { select: { id: true, title: true } } },
      orderBy: { hearingDate: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { userId, hearingDate: { gt: endOfDay(today) } },
      include: { case: { select: { id: true, title: true } } },
      orderBy: { hearingDate: "asc" },
      take: 7,
    }),
    prisma.task.findMany({
      where: { userId, status: "pending" },
      include: { case: { select: { id: true, title: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.case.findMany({
      where: { userId },
      select: { id: true, title: true, clientName: true, courtName: true, status: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.case.count({ where: { userId, status: "active" } }),
    prisma.task.count({ where: { userId, status: "pending" } }),
  ]);

  return {
    todayEvents,
    upcomingEvents,
    pendingTasks,
    allCases,
    totalCases,
    totalTasks,
  };
}
