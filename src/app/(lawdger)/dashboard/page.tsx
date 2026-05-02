import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";
import { format } from "date-fns";
import { Bell, Scale } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const userName = session.user.name ?? "Advocate";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const [pendingTasks, todayEvents, upcomingEvents, allCases, totalCases, totalTasks] =
    await Promise.all([
      prisma.task.findMany({
        where: { userId, status: "pending" },
        orderBy: { dueDate: "asc" },
        take: 20,
        include: { case: { select: { id: true, title: true } } },
      }),
      prisma.calendarEvent.findMany({
        where: { userId, hearingDate: { gte: todayStart, lte: todayEnd } },
        orderBy: { hearingDate: "asc" },
        include: { case: { select: { id: true, title: true } } },
      }),
      prisma.calendarEvent.findMany({
        where: { userId, hearingDate: { gt: todayEnd } },
        orderBy: { hearingDate: "asc" },
        take: 10,
        include: { case: { select: { id: true, title: true } } },
      }),
      prisma.case.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, clientName: true, courtName: true, status: true },
      }),
      prisma.case.count({ where: { userId } }),
      prisma.task.count({ where: { userId, status: "pending" } }),
    ]);

  const todayLabel = format(new Date(), "EEEE, d MMM").toUpperCase();
  const summaryParts = [];
  if (todayEvents.length === 0) summaryParts.push("No hearings today");
  else summaryParts.push(`${todayEvents.length} hearing${todayEvents.length > 1 ? "s" : ""} today`);
  if (totalTasks > 0) summaryParts.push(`${totalTasks} pending task${totalTasks > 1 ? "s" : ""}`);

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-white/5 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {todayLabel}
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground leading-tight">
            {greeting}, {userName}.
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-1.5">
            {summaryParts.join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <button className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/5 bg-card/60 text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 flex items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
            <Scale className="h-5 w-5" />
          </button>
        </div>
      </div>
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
    </div>
  );
}
