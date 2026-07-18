"use server";

import { getServerUser, withServerUserContext } from "@/lib/session";
import { startOfTodayIST, endOfTodayIST } from "@/lib/date";
import { getNextHearingDatesByCase } from "@/lib/next-hearing";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fail, type Result } from "@/lib/result";

type EventWithCase = Prisma.CalendarEventGetPayload<{
  include: { case: { select: { id: true; title: true } } };
}>;

type TaskWithCase = Prisma.TaskGetPayload<{
  include: { case: { select: { id: true; title: true } } };
}>;

type DashboardCase = Prisma.CaseGetPayload<{
  select: {
    id: true;
    title: true;
    clientName: true;
    status: true;
    nextHearingDate: true;
  };
}>;

export type DashboardData = {
  todayEvents: EventWithCase[];
  upcomingEvents: EventWithCase[];
  pendingTasks: TaskWithCase[];
  allCases: DashboardCase[];
  totalCases: number;
  totalTasks: number;
};

const getDashboardDataSchema = z.object({}).strict();

export async function getDashboardData(): Promise<Result<DashboardData>> {
  const parsed = getDashboardDataSchema.safeParse({});
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { id: userId } = await getServerUser();

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

    // Case.nextHearingDate is a synced cache column (see src/lib/calendar-sync.ts,
    // wired into all CalendarEvent mutations in calendarActions.ts). Read it
    // directly instead of re-deriving via a per-request groupBy.
    const allCases = await tx.case.findMany({
      where: { userId },
      select: { id: true, title: true, clientName: true, status: true, nextHearingDate: true },
      orderBy: { updatedAt: "desc" },
    });

    const totalCases = await tx.case.count({ where: { userId, status: "ACTIVE" } });
    const totalTasks = await tx.task.count({ where: { userId, status: "pending" } });

    // Live next-hearing from CalendarEvent (source of truth) instead of the
    // Case.nextHearingDate cache column. Same IST-today floor as the old
    // stale-past filter path — the query filters >= floor, so the value can
    // never be stale-past. W9 PR2.
    const nextByCase = await getNextHearingDatesByCase(
      tx,
      allCases.map((c) => c.id),
      startOfTodayIST(),
    );
    const allCasesFresh = allCases.map((c) => ({
      ...c,
      nextHearingDate: nextByCase.get(c.id) ?? null,
    }));

    return {
      ok: true,
      data: {
        todayEvents,
        upcomingEvents,
        pendingTasks,
        allCases: allCasesFresh,
        totalCases,
        totalTasks,
      },
    };
  });
}
