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
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "inactive":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "closed":
        return "bg-white/5 text-muted-foreground border-white/10";
      default:
        return "bg-white/5 text-muted-foreground border-white/10";
    }
  };

  return (
    <>
      {/* Header */}
      <div className="relative border-b border-white/5 bg-card/60 backdrop-blur-xl px-10 py-8 shrink-0 z-10 shadow-sm">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground mb-2">
              Active Cases
            </h1>
            <p className="text-muted-foreground text-lg font-light">
              {initialCases.length === 0
                ? "No cases yet. Add your first matter."
                : `${initialCases.length} matter${initialCases.length !== 1 ? "s" : ""} on record.`}
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-full hover:scale-105 transition-transform font-medium shadow-[0_0_20px_rgba(243,225,215,0.2)]"
          >
            <Plus className="h-4 w-4" />
            New Case
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 relative z-10">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cases by name, client, or court..."
                className="w-full bg-card/60 backdrop-blur-xl border border-white/10 rounded-full pl-12 pr-4 py-3.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all placeholder:text-muted-foreground/60 font-light"
              />
            </div>
            {/* Status filter pills */}
            <div className="flex bg-card/60 backdrop-blur-xl border border-white/10 rounded-full p-1.5 shadow-sm shrink-0">
              {(["all", "active", "inactive", "closed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-colors capitalize ${
                    statusFilter === s
                      ? "bg-white/10 font-medium text-foreground shadow-sm"
                      : "font-light text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Cases Grid */}
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-white/5 bg-card/60 backdrop-blur-xl p-16 text-center text-muted-foreground font-light shadow-2xl">
              {search || statusFilter !== "all"
                ? "No cases match your filters."
                : "No cases yet. Click 'New Case' to get started."}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filtered.map((c) => (
                <Link key={c.id} href={`/cases/${c.id}`} className="block group">
                  <div className="rounded-3xl border border-white/5 bg-card/60 backdrop-blur-md p-8 shadow-xl transition-all duration-300 hover:border-accent/40 hover:shadow-[0_0_30px_rgba(243,225,215,0.05)] hover:-translate-y-1 h-full flex flex-col relative">

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, c.id)}
                      className="absolute top-5 right-5 p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors opacity-0 group-hover:opacity-100 z-10"
                      title="Delete case"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="flex justify-between items-start mb-6 pr-8">
                      <div>
                        <h2 className="font-serif text-2xl font-medium text-foreground group-hover:text-accent transition-colors">
                          {c.title}
                        </h2>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border capitalize ${statusBadge(c.status)}`}
                      >
                        {c.status}
                      </span>
                    </div>

                    {/* Client & Court */}
                    <div className="mt-auto pt-5 border-t border-white/5 grid grid-cols-2 gap-4 mb-5">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">
                          Client
                        </p>
                        <p className="text-sm font-light">
                          {c.clientName ?? <span className="text-muted-foreground/50 italic">—</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">
                          Court
                        </p>
                        <p className="text-sm font-light flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-accent/70 shrink-0" />
                          {c.courtName ?? <span className="text-muted-foreground/50 italic">—</span>}
                        </p>
                      </div>
                    </div>

                    {/* Counts */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-light">
                      <span className="flex items-center gap-1">
                        <CheckSquare className="h-3.5 w-3.5" />
                        {c._count.tasks} task{c._count.tasks !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {c._count.notes} note{c._count.notes !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {c._count.calendarEvents} event{c._count.calendarEvents !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Case Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-white/10 rounded-3xl shadow-2xl w-full max-w-md relative">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="font-serif text-2xl font-medium">New Case</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCase} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Case Title *
                </label>
                <input
                  type="text"
                  required
                  value={newCase.title}
                  onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  placeholder="e.g. Sharma v. State"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Client Name
                </label>
                <input
                  type="text"
                  value={newCase.clientName}
                  onChange={(e) => setNewCase({ ...newCase, clientName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  placeholder="e.g. Amit Gupta"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Court / Forum
                </label>
                <input
                  type="text"
                  value={newCase.courtName}
                  onChange={(e) => setNewCase({ ...newCase, courtName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  placeholder="e.g. High Court of Delhi"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Agreed Fee
                  <span className="ml-2 normal-case font-normal tracking-normal text-muted-foreground/60">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newCase.agreedFee}
                    onChange={(e) => setNewCase({ ...newCase, agreedFee: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                    placeholder="e.g. 50000"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 bg-accent text-accent-foreground font-medium py-3 rounded-xl hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-60"
              >
                {isSubmitting ? "Saving…" : "Create Case"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
