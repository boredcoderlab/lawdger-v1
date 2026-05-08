"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Briefcase,
  X,
  Trash2,
  FileText,
  CheckSquare,
  CalendarDays,
  Activity,
  Layers
} from "lucide-react";
import { createCase, deleteCase } from "@/actions/caseActions";

type CaseWithCounts = {
  id: string;
  title: string;
  clientName: string | null;
  courtName: string | null;
  status: string;
  createdAt: Date;
  _count: { tasks: number; notes: number; calendarEvents: number };
};

export default function CasesClient({
  initialCases,
}: {
  initialCases: CaseWithCounts[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed" | "inactive">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCase, setNewCase] = useState({
    title: "",
    clientName: "",
    courtName: "",
    agreedFee: "",
  });

  const filtered = initialCases.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.clientName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.courtName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await createCase({
      title: newCase.title,
      clientName: newCase.clientName || undefined,
      courtName: newCase.courtName || undefined,
      agreedFee: newCase.agreedFee ? parseFloat(newCase.agreedFee) : undefined,
    });
    setNewCase({ title: "", clientName: "", courtName: "", agreedFee: "" });
    setIsModalOpen(false);
    setIsSubmitting(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Delete this case and all its data? This cannot be undone.")) {
      await deleteCase(id);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      case "inactive":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "closed":
        return "bg-black/5 dark:bg-white/5 text-muted-foreground border-black/10 dark:border-white/10";
      default:
        return "bg-black/5 dark:bg-white/5 text-muted-foreground border-black/10 dark:border-white/10";
    }
  };

  const activeCount = initialCases.filter(c => c.status === 'active').length;
  const closedCount = initialCases.filter(c => c.status === 'closed').length;

  return (
    <div className="relative flex flex-col flex-1 p-8 lg:p-12 min-h-screen bg-transparent text-foreground font-sans z-0">
      
      {/* Background Shapes Specific to Cases */}
      <div className="absolute top-[10%] left-[-5%] w-[60%] h-[70%] bg-primary/10 rounded-full blur-[140px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-end mb-10 z-10">
          <div>
            <h1 className="font-serif text-[2.8rem] font-bold tracking-tight text-foreground leading-none">
              Case Registry
            </h1>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3 rounded-full hover:scale-[1.02] transition-transform font-bold tracking-widest uppercase text-[12px] shadow-[0_0_20px_rgba(200,150,62,0.3)]"
          >
            <Plus className="h-4 w-4" />
            New Matter
          </button>
      </div>

      {/* ── OVERLAPPING PANES LAYOUT ────────────────────────────────────────── */}
      <div className="relative lg:w-[98%] xl:w-[95%] flex z-20 mx-auto">
        
        {/* Left: Dark Control Panel */}
        <div className="w-[42%] rounded-[2.5rem] bg-gradient-to-b from-[#3a2c23] to-[#291e16] p-10 pr-20 shadow-[0_30px_60px_rgba(0,0,0,0.4)] min-h-[500px] flex flex-col z-10 border border-white/5 shrink-0">
          
          <div className="flex items-center gap-4 mb-8">
             <div className="w-12 h-12 bg-white/40 rounded-2xl flex items-center justify-center text-white shadow-inner">
                 <Layers className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-[1.5rem] font-serif font-bold text-[#f4efe8] dark:text-white leading-tight">Master Index</h2>
                <p className="text-[12px] text-[#f4efe8]/60 dark:text-white/50 uppercase tracking-widest font-bold">Metrics & Filters</p>
             </div>
          </div>

          <div className="space-y-4 mb-10">
             <div className="bg-black/20 dark:bg-card/80 rounded-2xl p-5 border border-white/5 flex justify-between items-center">
                 <span className="text-[14px] text-[#f4efe8]/80 dark:text-white/80 font-medium">Total Matters</span>
                 <span className="text-[20px] text-white font-bold">{initialCases.length}</span>
             </div>
             <div className="bg-primary/20 dark:bg-primary/10 rounded-2xl p-5 border border-primary/20 flex justify-between items-center">
                 <span className="text-[14px] text-primary/90 dark:text-primary font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Active
                 </span>
                 <span className="text-[20px] text-white font-bold">{activeCount}</span>
             </div>
             <div className="bg-black/20 dark:bg-card/80 rounded-2xl p-5 border border-white/5 flex justify-between items-center">
                 <span className="text-[14px] text-[#f4efe8]/60 dark:text-white/50 font-medium">Closed</span>
                 <span className="text-[20px] text-white/50 font-bold">{closedCount}</span>
             </div>
          </div>

          <div className="mt-auto">
             <label className="block text-[10px] font-bold uppercase tracking-widest text-[#f4efe8]/50 dark:text-white/40 mb-3">Quick Search</label>
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find by name, client..."
                  className="w-full bg-black/20 dark:bg-card/80 border border-white/10 rounded-full pl-12 pr-4 py-4 text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner"
                />
             </div>
          </div>
        </div>

        {/* Right: Frosted Glass Registry Area overlapping ON TOP of the control panel */}
        <div className="w-[64%] -ml-[6%] mt-8 rounded-[2.5rem] bg-white/95 dark:bg-card/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.1)] p-10 min-h-[700px] flex flex-col z-30 pl-[16%]">
           
           <div className="flex justify-between items-end border-b border-primary/10 pb-6 mb-8">
              <h3 className="text-[1.3rem] font-bold text-foreground">Registry Entries</h3>
              
              {/* Status filter pills */}
              <div className="flex bg-white/95 dark:bg-card/80 border border-primary/10 rounded-full p-1 shadow-sm shrink-0">
                {(["all", "active", "inactive", "closed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-4 py-1.5 rounded-full text-[12px] tracking-wide transition-all capitalize font-bold ${
                      statusFilter === s
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
           </div>

          {/* Cases Grid */}
          {filtered.length === 0 ? (
            <div className="flex-1 rounded-[2rem] border border-dashed border-primary/20 bg-white/90 dark:bg-card/80 flex flex-col items-center justify-center text-center p-10 shadow-inner">
                <Briefcase className="w-12 h-12 text-primary/40 mb-4" />
                <h4 className="text-[1.2rem] font-bold text-foreground mb-1">No matches found</h4>
                <p className="text-muted-foreground text-[14px]">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 overflow-y-auto pr-2 pb-10 scrollbar-hide">
              {filtered.map((c) => (
                <Link key={c.id} href={`/cases/${c.id}`} className="block group">
                  <div className="rounded-[1.5rem] border border-white/50 dark:border-white/5 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-6 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-[0_15px_30px_rgba(200,150,62,0.1)] hover:-translate-y-1 h-full flex flex-col relative overflow-hidden">

                    {/* Subtle top accent line on card */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, c.id)}
                      className="absolute top-5 right-5 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100 z-10"
                      title="Delete case"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="flex justify-between items-start mb-5 pr-8">
                      <div>
                        <h2 className="font-serif text-[1.4rem] font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors leading-tight">
                          {c.title}
                        </h2>
                      </div>
                    </div>

                    <div className="mb-6">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border ${statusBadge(c.status)}`}>
                          {c.status}
                        </span>
                    </div>

                    {/* Client & Court */}
                    <div className="mt-auto pt-4 border-t border-primary/10 grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-1">
                          Client
                        </p>
                        <p className="text-[13px] font-medium text-foreground truncate">
                          {c.clientName ?? <span className="text-muted-foreground/50 italic">—</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-1">
                          Court
                        </p>
                        <p className="text-[13px] font-medium text-foreground flex items-center gap-1.5 truncate">
                          <Briefcase className="h-3 w-3 text-primary/70 shrink-0" />
                          {c.courtName ?? <span className="text-muted-foreground/50 italic">—</span>}
                        </p>
                      </div>
                    </div>

                    {/* Counts */}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-bold bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <CheckSquare className="h-3 w-3 text-primary/60" />
                        {c._count.tasks}
                      </span>
                      <div className="w-px h-3 bg-primary/10"></div>
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3 text-primary/60" />
                        {c._count.notes}
                      </span>
                      <div className="w-px h-3 bg-primary/10"></div>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3 text-primary/60" />
                        {c._count.calendarEvents}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Case Modal - Premium Redesign */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-background  rounded-[1.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden relative border border-white/60 dark:border-primary/20 animate-in fade-in zoom-in duration-200">
            
            <div className="flex justify-between items-center p-6 bg-white dark:bg-[#1A1918] border-b border-primary/10">
              <div className="flex items-center gap-4">
                 <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <Briefcase className="w-5 h-5" />
                 </div>
                 <div>
                    <h2 className="font-serif text-[1.5rem] font-bold text-gray-900 dark:text-white leading-none">Initialize Matter</h2>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-primary/60 mt-1.5">New Case Record</p>
                 </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-foreground/40 hover:text-foreground transition-colors p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCase} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Matter Title *
                </label>
                <input
                  type="text"
                  required
                  value={newCase.title}
                  onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                  className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground"
                  placeholder="e.g. Sharma v. State"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Client Identifier
                </label>
                <input
                  type="text"
                  value={newCase.clientName}
                  onChange={(e) => setNewCase({ ...newCase, clientName: e.target.value })}
                  className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground"
                  placeholder="e.g. Amit Gupta"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Court / Forum
                </label>
                <input
                  type="text"
                  value={newCase.courtName}
                  onChange={(e) => setNewCase({ ...newCase, courtName: e.target.value })}
                  className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground"
                  placeholder="e.g. High Court of Delhi"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(200,150,62,0.3)] hover:scale-[1.01] transition-all uppercase tracking-widest text-[12px] disabled:opacity-60"
                >
                  {isSubmitting ? "Generating Record…" : "Commit to Registry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
