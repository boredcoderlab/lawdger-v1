import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const tasks = [
  { id: 1, desc: 'File reply to notice', case: 'Sharma v. State', due: 'Today', status: 'pending', priority: 'high' },
  { id: 2, desc: 'Review witness statement', case: 'TechCorp Arbitration', due: 'Tomorrow', status: 'pending', priority: 'medium' },
  { id: 3, desc: 'Draft settlement agreement', case: 'Gupta Property Dispute', due: 'In 3 days', status: 'pending', priority: 'medium' },
  { id: 4, desc: 'Send invoice for consultation', case: 'TechCorp Arbitration', due: 'Overdue', status: 'pending', priority: 'high' },
];

export default function Tasks() {
  return (
    <div className="p-8 pb-32">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
      </div>

      {/* Task Filters */}
      <div className="flex gap-4 mb-8 border-b border-border pb-px">
        <button className="border-b-2 border-accent pb-2 text-sm font-medium text-foreground">All Tasks</button>
        <button className="border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pending</button>
        <button className="border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Completed</button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="divide-y divide-border">
          {tasks.map((task) => (
            <div key={task.id} className="p-6 transition-colors hover:bg-muted/50 flex items-start gap-4">
              <div className="mt-0.5 h-5 w-5 rounded border border-muted-foreground flex-shrink-0 cursor-pointer hover:border-accent transition-colors" />
              <div className="flex-1">
                <p className="font-medium text-foreground">{task.desc}</p>
                <div className="flex items-center gap-3 mt-2 text-sm">
                  <span className="text-accent">{task.case}</span>
                  <span className="w-1 h-1 rounded-full bg-border"></span>
                  <span className={`flex items-center gap-1 ${task.due === 'Overdue' ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {task.due === 'Overdue' ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {task.due}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
