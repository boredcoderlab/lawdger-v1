import { 
  CheckCircle2, Clock, ChevronRight, Scale, Briefcase
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="h-full bg-background text-foreground flex flex-col">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden border-b border-border bg-card px-8 py-8 shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-accent/20 via-background to-background opacity-50" />
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-accent mb-1 tracking-wide uppercase">{currentDate}</p>
            <h1 className="text-3xl font-extrabold tracking-tight mb-1">Good morning, Advocate.</h1>
            <p className="text-muted-foreground max-w-2xl">
              Your Legal Brain is ready. You have <span className="text-foreground font-semibold">3 hearings</span> and <span className="text-foreground font-semibold">8 priority tasks</span> scheduled for today.
            </p>
          </div>
          <div className="hidden md:flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 shadow-[0_0_40px_rgba(41,151,255,0.15)]">
            <Scale className="h-8 w-8 text-accent opacity-90" />
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full min-h-0">
        {/* TOP ROW: Agenda (Left/Center) + Tasks (Right) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">
          
          {/* COLUMN 1 & 2: Dynamic Agenda Timeline */}
          <div className="xl:col-span-2 rounded-2xl border border-border bg-card overflow-hidden shadow-sm flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4 shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" /> Today's Agenda
              </h2>
              <Link href="/calendar" className="text-sm font-medium text-muted-foreground hover:text-accent transition-colors flex items-center">
                View Calendar <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="relative border-l-2 border-border ml-3 space-y-8 pb-4">
                {/* Past Event */}
                <div className="relative pl-8 opacity-50">
                  <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-4 border-background bg-muted-foreground" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-muted-foreground">09:00 AM</p>
                      <p className="font-medium mt-1 line-through text-base">Client Briefing - Gupta Dispute</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground w-fit">Completed</span>
                  </div>
                </div>

                {/* Current/Next Event (Highlighted) */}
                <div className="relative pl-8">
                  <div className="absolute -left-[11px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background">
                    <div className="h-3 w-3 rounded-full bg-orange-500 animate-pulse ring-4 ring-orange-500/20" />
                  </div>
                  <div className="rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-transparent p-5 transition-colors hover:border-orange-500/50 -mt-3 shadow-lg shadow-orange-500/5">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                      <p className="text-sm font-bold text-orange-500">10:30 AM (Upcoming)</p>
                      <span className="inline-flex items-center rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-500 border border-orange-500/20 w-fit">Hearing</span>
                    </div>
                    <Link href="/cases/1" className="text-xl font-bold text-foreground hover:text-orange-500 transition-colors line-clamp-1">Sharma v. State</Link>
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2 font-medium">
                      <Briefcase className="h-4 w-4 shrink-0" /> High Court - Room 4B
                    </p>
                  </div>
                </div>

                {/* Future Event */}
                <div className="relative pl-8">
                  <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-4 border-background bg-border" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-muted-foreground">02:00 PM</p>
                      <Link href="/cases/2" className="font-medium text-foreground hover:text-accent transition-colors mt-1 block text-base">TechCorp Arbitration</Link>
                      <p className="text-sm text-muted-foreground mt-1">Virtual Hearing</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent border border-accent/20 w-fit">Hearing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 3: Actionable Tasks */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4 shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-purple-500" /> Action Required
              </h2>
            </div>
            
            <div className="divide-y divide-border overflow-y-auto flex-1">
              {/* Task 1 */}
              <div className="group flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-background group-hover:border-purple-500 transition-colors cursor-pointer shadow-sm">
                  <CheckCircle2 className="h-3 w-3 text-transparent group-hover:text-purple-500/80 transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground group-hover:text-purple-500 transition-colors text-sm">File reply to notice</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Sharma v. State</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500 ring-1 ring-inset ring-red-500/20 shadow-sm">
                      Due Today
                    </span>
                  </div>
                </div>
              </div>

              {/* Task 2 */}
              <div className="group flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-background group-hover:border-purple-500 transition-colors cursor-pointer shadow-sm">
                  <CheckCircle2 className="h-3 w-3 text-transparent group-hover:text-purple-500/80 transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground group-hover:text-purple-500 transition-colors text-sm">Review witness statement</p>
                  <p className="text-[11px] text-muted-foreground mt-1">TechCorp Arbitration</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-500 ring-1 ring-inset ring-orange-500/20 shadow-sm">
                      Due Tomorrow
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-card border-t border-border shrink-0">
              <Link href="/tasks" className="flex w-full justify-center rounded-lg bg-muted border border-border py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/80 hover:text-accent transition-all hover:border-accent/30">
                View All Tasks
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
