import { ArrowLeft, Clock, FileText, Calendar, CheckSquare, Plus } from 'lucide-react';
import Link from 'next/link';

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  return (
    <div className="p-8 pb-32">
      <Link href="/cases" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Cases
      </Link>
      
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Sharma v. State</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>Rajeev Sharma</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>High Court</span>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-500 border border-green-500/20">
          Active
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Timeline (Left 2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-xl font-semibold">Case Timeline</h2>
          </div>

          <div className="relative border-l border-border ml-3 space-y-8 pb-8">
            {/* Timeline Item 1 */}
            <div className="relative pl-8">
              <div className="absolute -left-3 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white ring-4 ring-background">
                <FileText className="h-3 w-3" />
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-flex items-center rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">Note</span>
                  <span className="text-xs text-muted-foreground">Today, 10:30 AM</span>
                </div>
                <p className="text-sm">Client updated that the opposing counsel has sought an extension for filing the reply. Instructed to object to the extension in the next hearing.</p>
              </div>
            </div>

            {/* Timeline Item 2 */}
            <div className="relative pl-8">
              <div className="absolute -left-3 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white ring-4 ring-background">
                <Calendar className="h-3 w-3" />
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500">Next Date</span>
                  <span className="text-xs text-muted-foreground">Yesterday, 4:15 PM</span>
                </div>
                <p className="text-sm font-medium">Hearing Scheduled</p>
                <p className="text-sm text-muted-foreground mt-1">Next hearing is scheduled for 15th Oct in Room 4B for cross-examination.</p>
              </div>
            </div>
            
            {/* Timeline Item 3 */}
            <div className="relative pl-8">
              <div className="absolute -left-3 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-white ring-4 ring-background">
                <CheckSquare className="h-3 w-3" />
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm opacity-60">
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-flex items-center rounded bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-500">Task Completed</span>
                  <span className="text-xs text-muted-foreground">Oct 10, 2025</span>
                </div>
                <p className="text-sm line-through">Draft application for interim relief.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar info (Right 1/3) */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Pending Tasks</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-4 w-4 rounded border border-muted-foreground flex-shrink-0 cursor-pointer hover:border-accent" />
                <p className="text-sm">File reply to notice before 12th</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-4 w-4 rounded border border-muted-foreground flex-shrink-0 cursor-pointer hover:border-accent" />
                <p className="text-sm">Collect medical records from client</p>
              </div>
            </div>
            <button className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors">
              <Plus className="h-4 w-4" /> Add Task
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Upcoming Events</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center justify-center bg-muted rounded-md h-12 w-12 flex-shrink-0">
                  <span className="text-xs font-medium text-accent">OCT</span>
                  <span className="text-lg font-bold">15</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Cross-examination</p>
                  <p className="text-xs text-muted-foreground mt-1">10:30 AM • Room 4B</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
