import TasksClient from "@/components/TasksClient";
import { listAllTasks, type TaskRow } from "@/actions/taskActions";
import { getCasesForSelect } from "@/actions/calendarActions";
import { getServerUser } from "@/lib/session";
import { bucketTask } from "@/lib/task-bucket";

export const dynamic = "force-dynamic";

function istDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default async function TasksPage() {
  const user = await getServerUser();
  const userName = user.name ?? null;

  const tasksResult = await listAllTasks();
  const cases = await getCasesForSelect();

  if (!tasksResult.ok) {
    return (
      <TasksClient
        buckets={{ unassigned: [], myPlate: [], associates: [] }}
        stats={{ total: 0, dueToday: 0, overdue: 0, doneThisWeek: 0 }}
        cases={cases}
        userName={userName}
        error={tasksResult.error}
      />
    );
  }

  const tasks = tasksResult.data;
  const buckets: { unassigned: TaskRow[]; myPlate: TaskRow[]; associates: TaskRow[] } = {
    unassigned: [],
    myPlate: [],
    associates: [],
  };
  for (const t of tasks) {
    const b = bucketTask({ assignee: t.assignee }, userName);
    if (b === "unassigned") buckets.unassigned.push(t);
    else if (b === "my-plate") buckets.myPlate.push(t);
    else buckets.associates.push(t);
  }

  const now = new Date();
  const todayKey = istDateKey(now);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const tracked = [...buckets.myPlate, ...buckets.associates];

  const stats = {
    total: tracked.filter((t) => t.status !== "completed").length,
    dueToday: tasks.filter(
      (t) => t.dueDate !== null && istDateKey(t.dueDate) === todayKey,
    ).length,
    overdue: tasks.filter(
      (t) =>
        t.dueDate !== null &&
        t.dueDate.getTime() < now.getTime() &&
        istDateKey(t.dueDate) !== todayKey &&
        t.status !== "completed",
    ).length,
    doneThisWeek: tasks.filter(
      (t) => t.status === "completed" && t.updatedAt.getTime() >= weekAgo.getTime(),
    ).length,
  };

  return (
    <TasksClient
      buckets={buckets}
      stats={stats}
      cases={cases}
      userName={userName}
    />
  );
}
