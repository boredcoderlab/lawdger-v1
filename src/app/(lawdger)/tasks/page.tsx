import TasksClient from '@/components/TasksClient';
import { getTasks } from '@/actions/taskActions';
import { getCasesForSelect } from '@/actions/calendarActions';

export default async function Tasks() {
  const [tasks, cases] = await Promise.all([getTasks(), getCasesForSelect()]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden">
      <div className="absolute top-[-50px] right-1/4 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-100px] h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      <TasksClient initialTasks={tasks} cases={cases} />
    </div>
  );
}
