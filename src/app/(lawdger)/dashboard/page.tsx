import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const userName = session.user.name ?? "Advocate";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [pendingTasks, todayEvents, upcomingEvents, allCases, totalCases, totalTasks] =
    await Promise.all([
      prisma.task.findMany({
        where: { userId, status: "pending" },
        orderBy: { dueDate: "asc" },
        take: 20,
        include: { case: { select: { id: true, title: true } } },
      }),
      prisma.calendarEvent.findMany({
        where: {
          userId,
          hearingDate: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { hearingDate: "asc" },
        include: { case: { select: { id: true, title: true } } },
      }),
      prisma.calendarEvent.findMany({
        where: {
          userId,
          hearingDate: { gt: todayEnd },
        },
        orderBy: { hearingDate: "asc" },
        take: 10,
        include: { case: { select: { id: true, title: true } } },
      }),
      prisma.case.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          clientName: true,
          courtName: true,
          status: true,
        },
      }),
      prisma.case.count({ where: { userId } }),
      prisma.task.count({ where: { userId, status: "pending" } }),
    ]);

  return (
    <div className="p-8">
      <DashboardClient
        userName={userName}
        pendingTasks={pendingTasks}
        todayEvents={todayEvents}
        upcomingEvents={upcomingEvents}
        allCases={allCases}
        totalCases={totalCases}
        totalTasks={totalTasks}
      />
    </div>
  );
}
