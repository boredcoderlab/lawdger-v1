"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, Briefcase, Calendar, CheckCircle2, X,
  ChevronRight, Clock, AlertCircle, ArrowRight,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

type Task = {
  id: string;
  description: string;
  dueDate: Date | null;
  case: { id: string; title: string } | null;
};

type Event = {
  id: string;
  title: string;
  hearingDate: Date;
  description: string | null;
  case: { id: string; title: string };
};

type CaseItem = {
  id: string;
  title: string;
  clientName: string | null;
  courtName: string | null;
  status: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDueLabel(date: Date | null) {
  if (!date) return null;
  const d = new Date(date);
  if (isPast(d) && !isToday(d)) return { label: "Overdue", cls: "text-red-400", urgent: true };
  if (isToday(d)) return { label: "Due today", cls: "text-orange-400", urgent: true };
  if (isTomorrow(d)) return { label: "Tomorrow", cls: "text-yellow-400", urgent: false };
  const diff = differenceInDays(d, new Date());
  if (diff < 7) return { label: `In ${diff}d`, cls: "text-muted-foreground", urgent: false };
  return { label: format(d, "MMM d"), cls: "text-muted-foreground", urgent: false };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardClient({
  userName,
  pendingTasks,
  todayEvents,
  upcomingEvents,
  allCases,
  totalCases,
  totalTasks,
}: {
  userName: string;
  pendingTasks: Task[];
  todayEvents: Event[];
  upcomingEvents: Event[];
  allCases: CaseItem[];
  totalCases: number;
  totalTasks: number;
}) {
  const [query, setQuery] = useState("");

  // Global search across cases + upcoming events + tasks
  const searchResults = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();

    const matchedCases = allCases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.clientName?.toLowerCase().includes(q) ||
        c.courtName?.toLowerCase().includes(q)
    );

    const matchedEvents = [...todayEvents, ...upcomingEvents].filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.case.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
    );

    const matchedTasks = pendingTasks.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.case?.title ?? "").toLowerCase().includes(q)
    );

    return { matchedCases, matchedEvents, matchedTasks };
  }, [query, allCases, todayEvents, upcomingEvents, pendingTasks]);

  const allEvents = [...todayEvents, ...upcomingEvents];
  const urgentTasks = pendingTasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return isPast(d) || isToday(d) || isTomorrow(d);
  });
  const hasUrgent = urgentTasks.length > 0;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Global Search ─────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <input
          id="dashboard-search"
          type="text"
          aria-label={`${userName} dashboard search`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cases, hearings, tasks…"
          autoComplete="off"
          className="w-full bg-card/60 backdrop-blur-xl border border-white/5 rounded-2xl pl-12 pr-12 py-4 text-base focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all placeholder:text-muted-foreground/50 shadow-lg"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Search Results ───────────────────────────────────────────────── */}
      {searchResults && (
        <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md overflow-hidden shadow-xl">
          {searchResults.matchedCases.length === 0 &&
           searchResults.matchedEvents.length === 0 &&
           searchResults.matchedTasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground font-light text-sm">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {/* Cases */}
              {searchResults.matchedCases.map((c) => (
                <Link key={c.id} href={`/cases/${c.id}`}
                  className="group flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors">
                  <Briefcase className="h-4 w-4 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground font-light">{c.clientName ?? "No client"} · {c.courtName ?? "No court"}</p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border border-white/10 rounded-full px-2 py-0.5 shrink-0">Case</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent shrink-0" />
                </Link>
              ))}
              {/* Events */}
              {searchResults.matchedEvents.map((e) => (
                <Link key={e.id} href={`/cases/${e.case.id}`}
                  className="group flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors">
                  <Calendar className="h-4 w-4 text-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground font-light">{e.case.title} · {format(new Date(e.hearingDate), "MMM d, yyyy")}</p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-400 border border-orange-500/20 rounded-full px-2 py-0.5 shrink-0 bg-orange-500/10">Hearing</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent shrink-0" />
                </Link>
              ))}
              {/* Tasks */}
              {searchResults.matchedTasks.map((t) => (
                <Link key={t.id} href={t.case ? `/cases/${t.case.id}` : "/tasks"}
                  className="group flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-light text-foreground/90 group-hover:text-foreground transition-colors truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground font-light">{t.case?.title ?? "Independent Task"}</p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-accent border border-accent/20 rounded-full px-2 py-0.5 shrink-0 bg-accent/10">Task</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Main Grid (shown when not searching) ─────────────────────────── */}
      {!searchResults && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Schedule — 2/3 width */}
          <div className="xl:col-span-2 flex flex-col gap-5">

            {/* Today's strip */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  Today
                </h2>
                <Link href="/calendar" className="text-xs text-muted-foreground hover:text-accent transition-colors flex items-center gap-1">
                  Calendar <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {todayEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-card/30 p-6 text-center text-muted-foreground text-sm font-light">
                  No hearings scheduled for today.{" "}
                  <Link href="/calendar" className="text-accent hover:underline">Add one →</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayEvents.map((ev, i) => (
                    <Link key={ev.id} href={`/cases/${ev.case.id}`}
                      className="group flex items-start gap-4 rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/8 to-transparent p-5 hover:border-accent/40 transition-all shadow-sm hover:shadow-[0_0_20px_rgba(243,225,215,0.08)]">
                      <div className="flex flex-col items-center justify-center rounded-xl bg-accent/10 border border-accent/20 h-14 w-14 shrink-0">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-accent">
                          {format(new Date(ev.hearingDate), "MMM")}
                        </span>
                        <span className="text-2xl font-serif font-bold text-accent leading-tight">
                          {format(new Date(ev.hearingDate), "d")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        {i === 0 && (
                          <span className="inline-block text-[9px] font-bold text-accent uppercase tracking-widest mb-1">
                            Next up · {format(new Date(ev.hearingDate), "h:mm aa")}
                          </span>
                        )}
                        <p className="font-serif text-lg font-medium text-foreground group-hover:text-accent transition-colors leading-snug">
                          {ev.title}
                        </p>
                        <p className="text-sm text-muted-foreground font-light mt-0.5 flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 shrink-0" /> {ev.case.title}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-accent shrink-0 mt-2 transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming hearings */}
            {upcomingEvents.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/20" />
                  Upcoming
                </h2>
                <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md overflow-hidden shadow-xl divide-y divide-white/5">
                  {upcomingEvents.map((ev) => (
                    <Link key={ev.id} href={`/cases/${ev.case.id}`}
                      className="group flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
                      <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 h-12 w-12 shrink-0">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          {format(new Date(ev.hearingDate), "MMM")}
                        </span>
                        <span className="text-base font-serif font-bold text-foreground leading-tight">
                          {format(new Date(ev.hearingDate), "d")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
                          {ev.title}
                        </p>
                        <p className="text-xs text-muted-foreground font-light mt-0.5">
                          {ev.case.title} · {format(new Date(ev.hearingDate), "EEE, MMM d")}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-accent shrink-0 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state — no schedule at all */}
            {allEvents.length === 0 && (
              <div className="rounded-2xl border border-white/5 bg-card/40 p-10 text-center text-muted-foreground font-light">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No hearings on the calendar yet.</p>
                <Link href="/calendar" className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  Open Calendar <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Right column — Stats + Tasks */}
          <div className="flex flex-col gap-5">

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Cases", value: totalCases, href: "/cases", color: "text-accent" },
                { label: "Pending", value: totalTasks, href: "/tasks", color: hasUrgent ? "text-red-400" : "text-foreground" },
              ].map((s) => (
                <Link key={s.label} href={s.href}
                  className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md p-4 hover:border-accent/20 transition-all group text-center">
                  <p className={`font-serif text-3xl font-bold ${s.color} group-hover:text-accent transition-colors`}>{s.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">{s.label}</p>
                </Link>
              ))}
            </div>

            {/* Urgent tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  {hasUrgent
                    ? <><span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />Urgent</>
                    : <><span className="inline-block h-1.5 w-1.5 rounded-full bg-white/20" />Tasks</>
                  }
                </h2>
                <Link href="/tasks" className="text-xs text-muted-foreground hover:text-accent transition-colors flex items-center gap-1">
                  All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {pendingTasks.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-card/40 p-6 text-center text-muted-foreground font-light text-sm">
                  <CheckCircle2 className="h-7 w-7 mx-auto mb-2 opacity-20" />
                  All clear.
                </div>
              ) : (
                <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md overflow-hidden shadow-xl divide-y divide-white/5">
                  {(hasUrgent ? urgentTasks : pendingTasks).slice(0, 5).map((task) => {
                    const due = getDueLabel(task.dueDate ? new Date(task.dueDate) : null);
                    return (
                      <Link key={task.id} href={task.case ? `/cases/${task.case.id}` : "/tasks"}
                        className="group flex items-start gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors">
                        <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${due?.urgent ? "border-red-400/60" : "border-white/20 group-hover:border-accent"} transition-colors`}>
                          {due?.urgent && <AlertCircle className="h-2.5 w-2.5 text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-light text-foreground/90 group-hover:text-foreground transition-colors line-clamp-2 leading-snug">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-muted-foreground font-light truncate">{task.case?.title ?? "Independent Task"}</span>
                            {due && (
                              <>
                                <span className="text-muted-foreground/30">·</span>
                                <span className={`text-[10px] font-semibold flex items-center gap-0.5 shrink-0 ${due.cls}`}>
                                  <Clock className="h-2.5 w-2.5" />{due.label}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                  {!hasUrgent && pendingTasks.length > 5 && (
                    <Link href="/tasks"
                      className="flex items-center justify-center gap-1 px-4 py-3 text-xs text-muted-foreground hover:text-accent transition-colors hover:bg-white/5">
                      +{pendingTasks.length - 5} more tasks <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
