import { getServerUser } from "@/lib/session";
import { getDashboardData } from "@/actions/dashboardActions";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const user = await getServerUser();
  const userName = user.name ?? "Advocate";

  const result = await getDashboardData();
  if (!result.ok) {
    console.error("[DashboardPage] getDashboardData failed:", result.error);
  }
  const data = result.ok
    ? result.data
    : {
        todayEvents: [],
        upcomingEvents: [],
        pendingTasks: [],
        allCases: [],
        totalCases: 0,
        totalTasks: 0,
      };

  return (
    <div className="h-full">
      <DashboardClient
        userName={userName}
        pendingTasks={data.pendingTasks}
        todayEvents={data.todayEvents}
        upcomingEvents={data.upcomingEvents}
        allCases={data.allCases}
        totalCases={data.totalCases}
        totalTasks={data.totalTasks}
      />
    </div>
  );
}
