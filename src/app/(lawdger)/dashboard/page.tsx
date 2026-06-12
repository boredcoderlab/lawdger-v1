import { getServerUser } from "@/lib/session";
import { getDashboardData } from "@/actions/dashboardActions";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const user = await getServerUser();
  const userName = user.name ?? "Advocate";

  const data = await getDashboardData();

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
