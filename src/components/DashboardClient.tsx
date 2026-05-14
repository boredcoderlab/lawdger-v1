"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  ChevronRight, Bell, Send, ChevronLeft, FileText, Download
} from "lucide-react";
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
  const [chatQuery, setChatQuery] = useState("");

  const searchResults = useMemo(() => {
    // Search logic remains identical
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    const matchedCases = allCases.filter(c => c.title.toLowerCase().includes(q) || c.clientName?.toLowerCase().includes(q));
    const matchedEvents = [...todayEvents, ...upcomingEvents].filter(e => e.title.toLowerCase().includes(q) || e.case.title.toLowerCase().includes(q));
    const matchedTasks = pendingTasks.filter(t => t.description.toLowerCase().includes(q));
    return { matchedCases, matchedEvents, matchedTasks };
  }, [query, allCases, todayEvents, upcomingEvents, pendingTasks]);

  // Dummy events to fill the timeline if empty, so it looks like the mockup
  const displayEvents = todayEvents.length > 0 ? todayEvents : [
    { id: "dummy1", title: "Court Appearance", case: { title: "Cosx appearances" }, hearingDate: new Date(new Date().setHours(9, 0)) },
    { id: "dummy2", title: "Client Consultation", case: { title: "" }, hearingDate: new Date(new Date().setHours(14, 0)) },
    { id: "dummy3", title: "Deadline Reminders", case: { title: "Filings by 5:00 PM" }, hearingDate: new Date(new Date().setHours(16, 0)) }
  ];

  return (
    <div className="relative flex flex-col flex-1 p-4 lg:px-8 lg:py-6 h-screen max-h-screen bg-background text-foreground font-sans overflow-hidden z-0">
      
      {/* ── GLOBAL BACKGROUND SHAPES ────────────────────────────────────────── */}
      <div className="absolute top-[12%] left-0 w-[85%] h-[85%] bg-muted rounded-r-[5rem] -z-10 pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[60%] h-[75%] bg-black/5 dark:bg-white/5 rounded-tl-[8rem] rounded-bl-[4rem] -z-20 pointer-events-none" />

      {/* ── MAIN BENTO GRID ────────────────────────────────────────────────── */}
      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-4 z-10 flex-1 min-h-0">
        
        {/* LEFT COLUMN: Hero Tile & Chatbot */}
        <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
          
          {/* TODAY AT A GLANCE (Hero Tile) */}
          <div className="relative rounded-[2.5rem] bg-gradient-to-br from-card to-card/80 p-6 lg:p-8 shadow-[0_20px_40px_rgba(41,30,22,0.06)] border border-white/50 dark:border-white/10 shrink-0">
            
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="font-serif text-[2rem] font-bold text-foreground leading-none mb-1">
                  Today at a Glance
                </h2>
                <p className="text-muted-foreground text-[15px]">
                  Organic daily schedule with primary items.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-10 w-10 flex items-center justify-center rounded-full border border-foreground/20 text-foreground hover:bg-black/5 transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button className="h-10 w-10 flex items-center justify-center rounded-full border border-foreground/20 text-foreground hover:bg-black/5 transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Redesigned Content to avoid overlap */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              
              {/* Left: Next Up (Hero Event) */}
              <div className="flex flex-col">
                <h3 className="text-[1.1rem] font-bold text-foreground mb-4">Next Up</h3>
                {displayEvents.length > 0 ? (
                  <div className="flex flex-col p-6 rounded-[1.5rem] bg-gradient-to-b from-lawdger-border to-lawdger-espresso text-lawdger-cream border border-white/5 shadow-md relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                      <Bell className="w-16 h-16" />
                    </div>
                    <div className="relative z-10">
                      <span className="px-3 py-1 bg-white/40 rounded-full text-[11px] font-bold tracking-wider uppercase mb-4 inline-block">
                        In 45 mins
                      </span>
                      <h4 className="text-[1.3rem] font-bold leading-tight mb-1">{displayEvents[0].title}</h4>
                      <p className="text-[14px] text-lawdger-cream/80 dark:text-white/80 mb-6">{displayEvents[0].case.title}</p>
                      
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex flex-col">
                          <span className="text-[12px] text-lawdger-cream/60 dark:text-white/60">Time</span>
                          <span className="text-[16px] font-bold">{format(new Date(displayEvents[0].hearingDate), "h:mm a")}</span>
                        </div>
                        <ChevronRight className="h-6 w-6 opacity-70 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center rounded-[1.5rem] border-2 border-dashed border-foreground/20 text-foreground/60 p-6 text-center">
                    Nothing pressing right now.
                  </div>
                )}
              </div>

              {/* Right: On the Radar (Compact List) */}
              <div className="flex flex-col">
                <h3 className="text-[1.1rem] font-bold text-foreground mb-4">On the Radar</h3>
                <div className="flex flex-col gap-3">
                  {displayEvents.slice(1, 4).map((ev, idx) => (
                    <div key={ev.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-black/5 transition-colors cursor-pointer group">
                      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-accent text-accent-foreground font-bold shrink-0 shadow-sm border border-white/60 dark:border-transparent">
                        <span className="text-[14px] leading-none">{format(new Date(ev.hearingDate), "h")}</span>
                        <span className="text-[10px] leading-none uppercase mt-0.5">{format(new Date(ev.hearingDate), "a")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[15px] font-bold text-foreground truncate group-hover:opacity-80 transition-opacity">{ev.title}</h4>
                        {ev.case.title && (
                          <p className="text-[12px] text-muted-foreground truncate mt-0.5">{ev.case.title}</p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-foreground opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  ))}
                  
                  {displayEvents.length <= 1 && (
                    <p className="text-[13px] text-muted-foreground italic mt-2">No other items scheduled for today.</p>
                  )}
                </div>
              </div>

            </div>
            
            {/* Added padding buffer at the bottom so the dark oval overlap doesn't hide content */}
            <div className="h-16 lg:h-24 w-full pointer-events-none" />
          </div>

        </div>

        {/* RIGHT COLUMN: Dates & Tasks */}
        <div className="lg:col-span-4 flex flex-col gap-4 z-10 min-h-0">
          
          {/* UPCOMING DATES */}
          <div className="rounded-[2rem] bg-card p-6 shadow-[0_15px_30px_rgba(41,30,22,0.06)] border border-white/50 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[1.2rem] font-bold text-foreground">
                Upcoming Dates
              </h2>
              <button className="text-foreground hover:opacity-70 transition-opacity">
                <span className="text-[1.5rem] leading-none tracking-widest pb-3">...</span>
              </button>
            </div>

            <div className="space-y-4">
              {upcomingEvents.length === 0 ? (
                // Dummy data to match mockup perfectly
                [
                  { date: "Nov 1st", title: "Trial Start", sub: "Nov 1st" },
                  { date: "Nov 2nd", title: "Coneping", sub: "Nov 2nd" },
                  { date: "Nov 3rd", title: "Client Remining", sub: "Nov 23rd" }
                ].map((ev, i) => (
                  <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-black/5 p-1.5 -mx-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`flex flex-col items-center justify-center rounded-[0.8rem] h-[52px] w-[50px] shadow-sm ${i === 0 ? 'bg-lawdger-espresso text-lawdger-cream dark:bg-primary dark:text-white' : 'bg-card border-[1.5px] border-border text-foreground'}`}>
                        <span className="text-[11px] font-medium leading-tight">Nov</span>
                        <span className="text-[14px] font-bold leading-tight">{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'}</span>
                      </div>
                      <div>
                        <h4 className="text-[1rem] font-bold text-foreground group-hover:opacity-80 transition-opacity">{ev.title}</h4>
                        <p className="text-[12px] text-muted-foreground">{ev.sub}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))
              ) : (
                upcomingEvents.slice(0, 3).map((ev, i) => (
                  <div key={ev.id} className="flex items-center justify-between group cursor-pointer hover:bg-black/5 p-1.5 -mx-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`flex flex-col items-center justify-center rounded-[0.8rem] h-[52px] w-[50px] shadow-sm ${i === 0 ? 'bg-lawdger-espresso text-lawdger-cream dark:bg-primary dark:text-white' : 'bg-card border-[1.5px] border-border text-foreground'}`}>
                        <span className="text-[11px] font-medium leading-tight">{format(new Date(ev.hearingDate), "MMM")}</span>
                        <span className="text-[14px] font-bold leading-tight">{format(new Date(ev.hearingDate), "do")}</span>
                      </div>
                      <div>
                        <h4 className="text-[1rem] font-bold text-foreground group-hover:opacity-80 transition-opacity truncate w-[140px]">{ev.title}</h4>
                        <p className="text-[12px] text-muted-foreground">{format(new Date(ev.hearingDate), "MMM do")}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RECENT DOCUMENTS */}
          <div className="rounded-[2rem] bg-card p-6 shadow-[0_15px_30px_rgba(41,30,22,0.06)] border border-white/50 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[1.2rem] font-bold text-foreground">
                Recent Documents
              </h2>
              <button className="text-foreground hover:opacity-70 transition-opacity">
                <span className="text-[1.5rem] leading-none tracking-widest pb-3">...</span>
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto min-h-0 pr-2">
              {/* Dummy data for mockup presentation */}
              {[
                { title: "Bail Petition - Sharma", type: "PDF", size: "2.4 MB", time: "2 hrs ago" },
                { title: "Affidavit of Evidence", type: "DOCX", size: "1.1 MB", time: "5 hrs ago" },
                { title: "Court Order - Case 102", type: "PDF", size: "850 KB", time: "Yesterday" },
                { title: "Legal Notice Draft", type: "DOCX", size: "14 KB", time: "Yesterday" }
              ].map((doc, i) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer border-b border-border last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-background/50 text-foreground group-hover:bg-background transition-colors shrink-0">
                      <FileText className="w-5 h-5 opacity-70" />
                    </div>
                    <div className="pr-2">
                      <h4 className="text-[14px] font-bold text-foreground truncate max-w-[150px] leading-tight">{doc.title}</h4>
                      <p className="text-[12px] text-muted-foreground mt-0.5">{doc.type} • {doc.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/5 transition-colors shrink-0">
                    <Download className="h-4 w-4 text-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>

      {/* ── BOTTOM OVAL CHATBOT WIDGET ────────────────────────────────────── */}
      <div className="relative mt-2 lg:-mt-10 lg:ml-20 lg:w-[calc(100%-25%)] flex z-20 shrink-0">
        
        {/* The massive dark brown background card */}
        <div className="w-[65%] rounded-[2rem] bg-gradient-to-b from-lawdger-border to-lawdger-espresso border border-white/5 p-6 shadow-2xl min-h-[220px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-[1.3rem] font-bold text-lawdger-cream dark:text-white">Active Cases</h2>
            <button className="text-lawdger-cream dark:text-white opacity-50 hover:opacity-100 transition-opacity">
              <span className="text-[1.5rem] leading-none tracking-widest pb-3">...</span>
            </button>
          </div>

          <div className="space-y-2 mt-4">
            {/* Quick Actions / Active Cases List mimicking mockup */}
            {[
              { title: "Court Appearance #1", time: "9:00 AM - 12:00 PM", status: "Discovery Phase", dim: true },
              { title: "Client Consultation #2", time: "2:00 PM - 2:00 PM", status: "Discovery Phase", dim: true },
              { title: "Client Appearance #3", time: "3:00 PM - 5:00 PM", status: "Awaiting Verdict", dim: false }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b border-white/10 last:border-0 pb-2 last:pb-0 cursor-pointer group">
                <div>
                  <h4 className="text-[14px] font-bold text-lawdger-cream dark:text-white group-hover:text-white">{item.title}</h4>
                  <p className="text-[12px] text-lawdger-cream/50 dark:text-white/50">{item.time}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${item.dim ? 'bg-white/40 text-white/80' : 'bg-lawdger-border dark:bg-primary text-white dark:text-primary-foreground'}`}>
                    {item.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-lawdger-cream/50 dark:text-white/50 group-hover:text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The Frosted Glass Chatbot Widget overlapping on the right */}
        <div className="absolute right-0 bottom-4 w-[45%] lg:w-[40%] rounded-[1.5rem] bg-lawdger-cream backdrop-blur-2xl border border-white/60 shadow-[0_30px_60px_rgba(0,0,0,0.2)] p-5 min-h-[180px] flex flex-col justify-end">
          
          {/* Logo overlapping top edge */}
          <div className="absolute -top-[2.5rem] left-6 flex items-center justify-center w-[70px] h-[80px] shadow-xl z-30">
            <div className="relative w-full h-full">
              <Image src="/lawdger-logo-transparent.png" alt="Lawdger Logo" fill className="object-contain drop-shadow-lg" />
            </div>
          </div>

          <div className="relative z-10 space-y-3 mt-4">
            <p className="text-[14px] font-medium text-foreground leading-snug">
              Hey, there I&apos;m your floating AI chatbot! <br/>
              <span className="opacity-80 font-normal text-[12px]">You can mention me for quick tasks.</span>
            </p>
            <div className="relative w-full">
              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-card border-none rounded-full pl-6 pr-14 py-3.5 text-[14px] text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 text-foreground rounded-full flex items-center justify-center hover:opacity-70 transition-opacity">
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
