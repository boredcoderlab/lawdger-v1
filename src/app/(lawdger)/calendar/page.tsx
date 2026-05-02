import { getCalendarEvents, getCasesForSelect } from "@/actions/calendarActions";
import { getTasksWithDueDate } from "@/actions/taskActions";
import CalendarClient from "@/components/CalendarClient";

export default async function CalendarPage() {
  const [events, cases, tasks] = await Promise.all([
    getCalendarEvents(),
    getCasesForSelect(),
    getTasksWithDueDate(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden">
      <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />
      <CalendarClient
        initialEvents={events}
        cases={cases}
        tasks={tasks.map((t) => ({ ...t, dueDate: t.dueDate! }))}
      />
    </div>
  );
}
