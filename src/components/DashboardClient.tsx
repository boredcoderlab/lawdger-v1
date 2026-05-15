"use client";

import { ChevronRight, Bell, ChevronLeft, FileText, Download } from "lucide-react";
import { format } from "date-fns";

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardClient({
  pendingTasks: _pendingTasks,
  todayEvents,
  upcomingEvents,
  allCases: _allCases,
}: {
  userName: string;
  pendingTasks: Task[];
  todayEvents: Event[];
  upcomingEvents: Event[];
  allCases: CaseItem[];
  totalCases: number;
  totalTasks: number;
}) {
  // Dummy events to fill the timeline if empty
  const displayEvents = todayEvents.length > 0 ? todayEvents : [
    { id: "dummy1", title: "Court Appearance", case: { title: "Court appearances" }, hearingDate: new Date(new Date().setHours(9, 0)) },
    { id: "dummy2", title: "Client Consultation", case: { title: "" }, hearingDate: new Date(new Date().setHours(14, 0)) },
    { id: "dummy3", title: "Deadline Reminders", case: { title: "Filings by 5:00 PM" }, hearingDate: new Date(new Date().setHours(16, 0)) }
  ];

  const activeCases = [
    { title: "Court Appearance #1", time: "9:00 AM - 12:00 PM", status: "Discovery Phase", accent: false },
    { title: "Client Consultation #2", time: "2:00 PM - 2:00 PM", status: "Discovery Phase", accent: false },
    { title: "Client Appearance #3", time: "3:00 PM - 5:00 PM", status: "Awaiting Verdict", accent: true },
  ];

  return (
    <div className="h-full overflow-hidden p-4 lg:p-6 bg-background text-foreground font-sans flex flex-col">

      {/* ── TOP GRID (cream) ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 flex-1 min-h-0">

        {/* LEFT — Today at a Glance */}
        <div className="min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white rounded-2xl border border-lawdger-border/15 shadow-sm">
            <div className="flex items-start justify-between px-6 pt-5 pb-4 shrink-0">
              <div>
                <h2 className="font-serif text-2xl font-bold text-lawdger-espresso leading-tight">Today at a Glance</h2>
                <p className="text-muted-foreground text-[13px] mt-0.5">Organic daily schedule with primary items.</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-8 w-8 flex items-center justify-center rounded-full border border-lawdger-border/20 text-lawdger-espresso hover:bg-lawdger-border/5 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className="h-8 w-8 flex items-center justify-center rounded-full border border-lawdger-border/20 text-lawdger-espresso hover:bg-lawdger-border/5 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 pb-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Next Up (Hero) */}
                <div className="flex flex-col">
                  <h3 className="text-[13px] font-bold uppercase tracking-wider text-lawdger-espresso/70 mb-3">Next Up</h3>
                  {displayEvents.length > 0 ? (
                    <div className="flex flex-col p-5 rounded-2xl bg-gradient-to-b from-lawdger-border to-lawdger-espresso text-lawdger-cream border border-white/5 shadow-md relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.01]">
                      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                        <Bell className="w-12 h-12" />
                      </div>
                      <div className="relative z-10">
                        <span className="px-2.5 py-1 bg-white/30 rounded-full text-[10px] font-bold tracking-wider uppercase mb-3 inline-block">
                          In 45 mins
                        </span>
                        <h4 className="text-[1.15rem] font-bold leading-tight mb-1">{displayEvents[0].title}</h4>
                        <p className="text-[13px] text-lawdger-cream/80 mb-4">{displayEvents[0].case.title}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[11px] text-lawdger-cream/60">Time</span>
                            <span className="text-[15px] font-bold">{format(new Date(displayEvents[0].hearingDate), "h:mm a")}</span>
                          </div>
                          <ChevronRight className="h-5 w-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center rounded-2xl border-2 border-dashed border-lawdger-border/20 text-lawdger-espresso/60 p-6 text-center text-[13px]">
                      Nothing pressing right now.
                    </div>
                  )}
                </div>

                {/* On the Radar */}
                <div className="flex flex-col">
                  <h3 className="text-[13px] font-bold uppercase tracking-wider text-lawdger-espresso/70 mb-3">On the Radar</h3>
                  <div className="flex flex-col gap-2">
                    {displayEvents.slice(1, 4).map((ev) => (
                      <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-lawdger-border/5 transition-colors cursor-pointer group">
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-accent text-accent-foreground font-bold shrink-0 shadow-sm border border-white/60">
                          <span className="text-[13px] leading-none">{format(new Date(ev.hearingDate), "h")}</span>
                          <span className="text-[9px] leading-none uppercase mt-0.5">{format(new Date(ev.hearingDate), "a")}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[14px] font-bold text-lawdger-espresso truncate">{ev.title}</h4>
                          {ev.case.title && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{ev.case.title}</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-lawdger-espresso opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    ))}
                    {displayEvents.length <= 1 && (
                      <p className="text-[12px] text-muted-foreground italic mt-1">No other items scheduled for today.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Upcoming Dates + Recent Documents */}
        <div className="flex flex-col gap-4 min-h-0">

          {/* UPCOMING DATES */}
          <div className="shrink-0 bg-white rounded-2xl border border-lawdger-border/15 shadow-sm">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="font-serif text-xl text-lawdger-espresso leading-tight">Upcoming Dates</h2>
              <button className="text-lawdger-espresso/50 hover:text-lawdger-espresso transition-colors">
                <span className="text-xl leading-none tracking-widest">…</span>
              </button>
            </div>
            <div className="px-5 pb-4 space-y-1">
              {(upcomingEvents.length === 0
                ? [
                    { date: new Date(new Date().setDate(new Date().getDate() + 1)), title: "Trial Start" },
                    { date: new Date(new Date().setDate(new Date().getDate() + 2)), title: "Cone-up" },
                    { date: new Date(new Date().setDate(new Date().getDate() + 3)), title: "Client Reminder" },
                  ]
                : upcomingEvents.slice(0, 3).map((ev) => ({ date: new Date(ev.hearingDate), title: ev.title }))
              ).map((ev, i) => (
                <div key={i} className="flex items-center justify-between py-2 group cursor-pointer hover:bg-lawdger-border/5 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex flex-col items-center justify-center rounded-lg h-11 w-11 shrink-0 ${i === 0 ? "bg-lawdger-espresso text-lawdger-cream" : "bg-white border border-lawdger-border/20 text-lawdger-espresso"}`}>
                      <span className="text-[10px] font-medium leading-none">{format(ev.date, "MMM").toUpperCase()}</span>
                      <span className="text-[13px] font-bold leading-tight mt-0.5">{format(ev.date, "d")}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-bold text-lawdger-espresso truncate">{ev.title}</h4>
                      <p className="text-[11px] text-muted-foreground">{format(ev.date, "EEEE")}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-lawdger-espresso opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* RECENT DOCUMENTS */}
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl border border-lawdger-border/15 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
              <h2 className="font-serif text-xl text-lawdger-espresso leading-tight">Recent Documents</h2>
              <button className="text-lawdger-espresso/50 hover:text-lawdger-espresso transition-colors">
                <span className="text-xl leading-none tracking-widest">…</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 pb-4">
              <div className="divide-y divide-lawdger-border/10">
                {[
                  { title: "Bail Petition - Sharma", type: "PDF", time: "2 hrs ago" },
                  { title: "Affidavit of Evidence", type: "DOCX", time: "5 hrs ago" },
                  { title: "Court Order - Case 102", type: "PDF", time: "Yesterday" },
                  { title: "Legal Notice Draft", type: "DOCX", time: "Yesterday" },
                ].map((doc, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 cursor-pointer group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-lawdger-border/5 text-lawdger-espresso group-hover:bg-lawdger-border/10 transition-colors shrink-0">
                        <FileText className="w-4 h-4 opacity-70" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-bold text-lawdger-espresso truncate leading-tight">{doc.title}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{doc.type} • {doc.time}</p>
                      </div>
                    </div>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-lawdger-border/10 transition-colors shrink-0">
                      <Download className="h-4 w-4 text-lawdger-espresso opacity-40 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ── ACTIVE CASES (espresso, rising from below) ────────────────────── */}
      <div
        className="w-full bg-lawdger-espresso rounded-2xl p-4 lg:p-5 mt-4 shrink-0"
        style={{ boxShadow: "0 -4px 20px rgba(61,46,38,0.15)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-lawdger-cream font-bold leading-tight">Active Cases</h2>
          <button className="text-lawdger-cream/60 hover:text-lawdger-cream transition-colors">
            <span className="text-xl leading-none tracking-widest">…</span>
          </button>
        </div>
        <div className="flex flex-col gap-2 mt-3">
          {activeCases.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-lawdger-cream/[0.08] border border-lawdger-cream/[0.12] rounded-xl px-4 py-3 cursor-pointer group hover:bg-lawdger-cream/[0.12] transition-colors"
            >
              <div className="min-w-0 pr-3">
                <h4 className="font-medium text-lawdger-cream text-sm">{item.title}</h4>
                <p className="text-lawdger-cream/60 text-xs mt-0.5">{item.time}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${item.accent ? "bg-lawdger-cream text-lawdger-espresso" : "bg-lawdger-cream/10 text-lawdger-cream"}`}>
                  {item.status}
                </span>
                <ChevronRight className="h-4 w-4 text-lawdger-cream/60 group-hover:text-lawdger-cream" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
