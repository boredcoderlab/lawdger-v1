import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, CheckSquare, Mic } from "lucide-react";
import { format } from "date-fns";
import { getCaseById } from "@/actions/caseActions";
import CaseDetailClient from "@/components/CaseDetailClient";

const STATUS_BADGE: Record<string, string> = {
  active:   "bg-green-500/10 text-green-400 border-green-500/20",
  inactive: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  closed:   "bg-white/5 text-muted-foreground border-white/10",
};

const CATEGORY_COLOR: Record<string, { dot: string; badge: string }> = {
  "General Note":  { dot: "bg-blue-400",   badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  "Client Update": { dot: "bg-purple-400",  badge: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  "Next Date":     { dot: "bg-orange-400",  badge: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  "Task":          { dot: "bg-accent",      badge: "bg-accent/10 text-accent border-accent/20" },
};

export default async function CaseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caseData = await getCaseById(id);
  if (!caseData) notFound();

  const manualNotes  = caseData.notes.filter((n) => n.source !== "voice");
  const voiceArchive = caseData.notes.filter((n) => n.source === "voice");

  type TimelineItem =
    | { kind: "note";  id: string; date: Date; content: string; category: string }
    | { kind: "task";  id: string; date: Date; description: string; status: string; dueDate: Date | null }
    | { kind: "event"; id: string; date: Date; title: string; description: string | null };

  const timeline: TimelineItem[] = [
    ...manualNotes.map((n) => ({
      kind: "note" as const,
      id: n.id,
      date: n.createdAt,
      content: n.cleanContent,
      category: n.category,
    })),
    ...caseData.tasks.map((t) => ({
      kind: "task" as const,
      id: t.id,
      date: t.dueDate ?? t.createdAt,
      description: t.description,
      status: t.status,
      dueDate: t.dueDate,
    })),
    ...caseData.calendarEvents.map((e) => ({
      kind: "event" as const,
      id: e.id,
      date: e.hearingDate,
      title: e.title,
      description: e.description,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const statusBadge = STATUS_BADGE[caseData.status] ?? STATUS_BADGE.active;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden">
      {/* Background glows — same as other pages */}
      <div className="absolute top-[-100px] left-[-100px] h-[500px] w-[500px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="relative border-b border-white/5 bg-card/60 backdrop-blur-xl px-10 py-8 shrink-0 z-10 shadow-sm">
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-accent transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cases
        </Link>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
              {caseData.title}
            </h1>
            <div className="flex items-center gap-3 mt-2.5">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadge}`}>
                {caseData.status}
              </span>
              {caseData.clientName && (
                <span className="text-sm text-muted-foreground font-light">{caseData.clientName}</span>
              )}
              {caseData.clientName && caseData.courtName && (
                <span className="text-muted-foreground/30">·</span>
              )}
              {caseData.courtName && (
                <span className="text-sm text-muted-foreground font-light">{caseData.courtName}</span>
              )}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 shrink-0 pb-1">
            <div className="text-right">
              <p className="font-serif text-2xl font-semibold text-foreground">{caseData.calendarEvents.length}</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">Hearings</p>
            </div>
            <div className="text-right">
              <p className="font-serif text-2xl font-semibold text-foreground">
                {caseData.tasks.filter((t) => t.status === "pending").length}
              </p>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">Tasks</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-8 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

          {/* ══ Timeline — xl:col-span-2 ══════════════════════ */}
          <div className="xl:col-span-2 flex flex-col gap-5">

            {/* Section label */}
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              Case Timeline
              {timeline.length > 0 && (
                <span className="ml-auto text-muted-foreground/40 font-normal normal-case tracking-normal">
                  {timeline.length} {timeline.length === 1 ? "entry" : "entries"}
                </span>
              )}
            </h2>

            {/* Empty */}
            {timeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-card/30 p-10 text-center text-muted-foreground text-sm font-light">
                No activity yet. Add a task, note, or hearing to get started.
              </div>
            ) : (
              <div className="relative border-l border-white/10 ml-3 space-y-4 pb-2">
                {timeline.map((item) => {

                  /* ── Hearing ─────────────────────────────── */
                  if (item.kind === "event") {
                    return (
                      <div key={item.id} className="relative pl-8">
                        <div className="absolute -left-3.5 top-1.5 h-7 w-7 flex items-center justify-center rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          <Calendar className="h-3.5 w-3.5" />
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md px-5 py-4 shadow-xl hover:border-orange-500/20 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-400">
                                Hearing
                              </span>
                              <p className="font-serif text-base font-medium text-foreground mt-1 leading-snug">
                                {item.title}
                              </p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground font-light mt-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest shrink-0 mt-0.5">
                              {format(item.date, "d MMM yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  /* ── Task ────────────────────────────────── */
                  if (item.kind === "task") {
                    const done = item.status === "completed";
                    return (
                      <div key={item.id} className={`relative pl-8 ${done ? "opacity-50" : ""}`}>
                        <div className={`absolute -left-3.5 top-1.5 h-7 w-7 flex items-center justify-center rounded-full border ${
                          done
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-accent/15 text-accent border-accent/25"
                        }`}>
                          <CheckSquare className="h-3.5 w-3.5" />
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md px-5 py-4 shadow-xl transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <span className={`text-[10px] font-semibold uppercase tracking-widest ${done ? "text-green-400" : "text-accent"}`}>
                                {done ? "Done" : "Task"}
                              </span>
                              <p className={`text-sm font-light mt-1 leading-relaxed ${done ? "line-through text-muted-foreground" : "text-foreground/90"}`}>
                                {item.description}
                              </p>
                            </div>
                            {item.dueDate && (
                              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest shrink-0 mt-0.5">
                                Due {format(item.dueDate, "d MMM yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  /* ── Note ────────────────────────────────── */
                  const colors = CATEGORY_COLOR[item.category] ?? CATEGORY_COLOR["General Note"];
                  return (
                    <div key={item.id} className="relative pl-8">
                      <div className={`absolute -left-2 top-2.5 h-4 w-4 rounded-full border-2 border-background ${colors.dot}`} />
                      <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md px-5 py-4 shadow-xl hover:border-white/10 transition-colors">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${colors.badge}`}>
                            {item.category}
                          </span>
                          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest shrink-0">
                            {format(item.date, "d MMM yyyy")}
                          </span>
                        </div>
                        <p className="text-sm font-light text-foreground/90 leading-relaxed">
                          {item.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Voice Archive */}
            {voiceArchive.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden">
                <details className="group">
                  <summary className="flex items-center gap-2.5 cursor-pointer select-none list-none px-5 py-4 hover:bg-white/5 transition-colors">
                    <Mic className="h-4 w-4 text-muted-foreground/50" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Voice Archive
                    </span>
                    <span className="ml-1 text-xs bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-muted-foreground/60">
                      {voiceArchive.length}
                    </span>
                    <span className="ml-auto text-muted-foreground/30 text-xs group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <div className="border-t border-white/5 divide-y divide-white/5">
                    {voiceArchive.map((note) => (
                      <div key={note.id} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground/50 font-medium">
                            <Mic className="h-3 w-3" />
                            {note.category}
                          </span>
                          <span className="text-xs text-muted-foreground/40">
                            {format(new Date(note.createdAt), "d MMM yyyy, HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm font-light text-muted-foreground leading-relaxed">{note.cleanContent}</p>
                        {note.rawTranscript && (
                          <p className="mt-2 pt-2 border-t border-white/5 text-xs text-muted-foreground/40 italic font-light leading-relaxed">
                            &ldquo;{note.rawTranscript}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* ══ Sidebar ════════════════════════════════════════ */}
          <div className="xl:sticky xl:top-6">
            <CaseDetailClient
              caseId={caseData.id}
              initialTitle={caseData.title}
              initialClientName={caseData.clientName}
              initialCourtName={caseData.courtName}
              initialAgreedFee={caseData.agreedFee}
              initialStatus={caseData.status}
              initialTasks={caseData.tasks}
              upcomingHearings={caseData.calendarEvents}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
