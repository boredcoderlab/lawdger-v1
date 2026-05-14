"use client";

import { useState } from "react";
import {
  Plus, X, CheckCircle2, Trash2, Clock, AlertCircle,
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Pencil, Check, Briefcase, Building2, IndianRupee, FileText,
  StickyNote, BriefcaseBusiness
} from "lucide-react";
import {
  format, isPast, isToday, isTomorrow, differenceInDays,
  subMonths, addMonths, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, parse,
} from "date-fns";
import {
  createCaseTask, toggleCaseTaskStatus, deleteCaseTask,
  createNote, updateCaseDetails,
} from "@/actions/caseActions";
import { PageLayout, DarkPaneHeaderTitle } from "@/components/ui/LayoutShell";

// ── Types ────────────────────────────────────────────────────────────────────

type Task = {
  id: string;
  description: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
};

type CalendarEvent = {
  id: string;
  title: string;
  hearingDate: Date;
  description: string | null;
};

const STATUS_OPTIONS = ["active", "inactive", "closed"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_STYLES: Record<Status, string> = {
  active:   "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  inactive: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  closed:   "bg-black/5 dark:bg-white/5 text-muted-foreground border-black/10 dark:border-white/10",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function CaseDetailClient({
  caseId,
  initialTitle,
  initialClientName,
  initialCourtName,
  initialAgreedFee,
  initialStatus,
  initialTasks,
  upcomingHearings,
}: {
  caseId: string;
  initialTitle: string;
  initialClientName: string | null;
  initialCourtName: string | null;
  initialAgreedFee: number | null;
  initialStatus: string;
  initialTasks: Task[];
  upcomingHearings: CalendarEvent[];
}) {

  // ── Case info edit ──────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [info, setInfo] = useState({
    title:      initialTitle,
    clientName: initialClientName ?? "",
    courtName:  initialCourtName  ?? "",
    agreedFee:  initialAgreedFee != null ? String(initialAgreedFee) : "",
    status:     initialStatus as Status,
  });

  const handleSave = async () => {
    setSaving(true);
    await updateCaseDetails(caseId, {
      title:      info.title || undefined,
      clientName: info.clientName || null,
      courtName:  info.courtName  || null,
      agreedFee:  info.agreedFee ? parseFloat(info.agreedFee) : null,
      status:     info.status,
    });
    setIsEditing(false);
    setSaving(false);
  };

  const cancelEdit = () => {
    setInfo({
      title:      initialTitle,
      clientName: initialClientName ?? "",
      courtName:  initialCourtName  ?? "",
      agreedFee:  initialAgreedFee != null ? String(initialAgreedFee) : "",
      status:     initialStatus as Status,
    });
    setIsEditing(false);
  };

  // ── Tasks ───────────────────────────────────────────────────────────────────
  const [taskModalOpen,  setTaskModalOpen]  = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerMonth,    setPickerMonth]    = useState(new Date());
  const [newTask,        setNewTask]        = useState({ desc: "", due: "" });
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  const pendingTasks   = initialTasks.filter((t) => t.status === "pending");
  const completedTasks = initialTasks.filter((t) => t.status === "completed");

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskSubmitting(true);
    await createCaseTask({
      caseId,
      description: newTask.desc,
      dueDate: newTask.due ? new Date(newTask.due) : undefined,
    });
    setNewTask({ desc: "", due: "" });
    setTaskModalOpen(false);
    setDatePickerOpen(false);
    setTaskSubmitting(false);
  };

  const getDueLabel = (date: Date | null) => {
    if (!date) return null;
    if (isToday(date))    return { label: "Today",    cls: "text-orange-600 dark:text-orange-400" };
    if (isTomorrow(date)) return { label: "Tomorrow", cls: "text-amber-600 dark:text-amber-400" };
    if (isPast(date))     return { label: "Overdue",  cls: "text-red-600 dark:text-red-400" };
    const diff = differenceInDays(date, new Date());
    if (diff < 7)         return { label: `In ${diff}d`, cls: "text-muted-foreground" };
    return { label: format(date, "d MMM"), cls: "text-muted-foreground" };
  };

  // ── Note composer ───────────────────────────────────────────────────────────
  const [noteOpen,       setNoteOpen]       = useState(false);
  const [noteContent,    setNoteContent]    = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setNoteSubmitting(true);
    await createNote({ caseId, cleanContent: noteContent.trim(), category: "General Note" });
    setNoteContent("");
    setNoteOpen(false);
    setNoteSubmitting(false);
  };

  // ── Next hearing ────────────────────────────────────────────────────────────
  const now         = new Date();
  const nextHearing = upcomingHearings.find((h) => new Date(h.hearingDate) >= now);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <PageLayout
        pageTitle={info.title}
        backToDashboard
        darkPaneHeader={
          <DarkPaneHeaderTitle
            icon={BriefcaseBusiness}
            title="Case Profile"
            subtitle="Details & Meta"
          />
        }
        darkPaneContent={
          <>
            {/* Case Profile Card */}
            <div className="bg-black/20 dark:bg-card/80 rounded-[2rem] p-6 shadow-inner border border-white/5 mb-8">
              {isEditing ? (
                <div className="space-y-4">
                  <EditField label="Case Title">
                    <input
                      value={info.title}
                      onChange={(e) => setInfo({ ...info, title: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:border-primary transition-all shadow-inner"
                    />
                  </EditField>
                  <EditField label="Client">
                    <input
                      value={info.clientName}
                      onChange={(e) => setInfo({ ...info, clientName: e.target.value })}
                      placeholder="e.g. Amit Gupta"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:border-primary transition-all shadow-inner"
                    />
                  </EditField>
                  <EditField label="Court / Forum">
                    <input
                      value={info.courtName}
                      onChange={(e) => setInfo({ ...info, courtName: e.target.value })}
                      placeholder="e.g. High Court of Delhi"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:border-primary transition-all shadow-inner"
                    />
                  </EditField>
                  <EditField label="Agreed Fee">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/50">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={info.agreedFee}
                        onChange={(e) => setInfo({ ...info, agreedFee: e.target.value })}
                        placeholder="0"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-[13px] text-white focus:outline-none focus:border-primary transition-all shadow-inner"
                      />
                    </div>
                  </EditField>
                  <EditField label="Status">
                    <div className="flex gap-2">
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setInfo({ ...info, status: s })}
                          className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors border ${
                            info.status === s
                              ? "bg-primary border-primary text-primary-foreground shadow-md"
                              : "border-white/10 text-white/50 hover:bg-white/5"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </EditField>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:shadow-[0_0_15px_rgba(200,150,62,0.4)] transition-all disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save Profile"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white/5 ${
                        info.status === 'active' ? 'text-primary border-primary/30' :
                        info.status === 'inactive' ? 'text-amber-400 border-amber-400/30' :
                        'text-white/40 border-white/10'
                    }`}>
                      {info.status}
                    </span>
                  </div>
                  <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Client Identifier" value={info.clientName || null} />
                  <InfoRow icon={<Building2  className="h-4 w-4" />} label="Court / Jurisdiction" value={info.courtName  || null} />
                  <InfoRow
                    icon={<IndianRupee className="h-4 w-4" />}
                    label="Agreed Fee Structure"
                    value={info.agreedFee ? `₹${parseFloat(info.agreedFee).toLocaleString("en-IN")}` : null}
                  />
                </div>
              )}
            </div>

            {/* Quick Case Notes */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/50 mb-3 ml-2">Quick Case Notes</h3>
              {noteOpen ? (
                <form onSubmit={handleAddNote} className="space-y-3">
                  <textarea
                    autoFocus
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={3}
                    placeholder="Drop a quick thought..."
                    className="w-full bg-black/20 dark:bg-card/80 border border-white/5 rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none shadow-inner"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setNoteOpen(false); setNoteContent(""); }}
                      className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white rounded-xl hover:bg-white/5 transition-colors border border-transparent">
                      Cancel
                    </button>
                    <button type="submit" disabled={noteSubmitting || !noteContent.trim()}
                      className="flex-1 bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase tracking-widest py-2.5 rounded-xl hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-60 shadow-sm">
                      {noteSubmitting ? "Saving…" : "Attach Note"}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setNoteOpen(true)}
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-4 rounded-xl bg-black/20 dark:bg-card/80 border border-white/5 text-[12px] font-bold uppercase tracking-widest text-white/50 hover:text-white hover:border-primary/30 transition-all group"
                >
                  <StickyNote className="h-4 w-4 text-white/30 group-hover:text-primary transition-colors" />
                  Jot down note
                </button>
              )}
            </div>
          </>
        }
        mainPaneHeader={
          <>
            <div>
              <h2 className="font-serif text-[1.6rem] font-bold text-foreground leading-none max-w-[500px] truncate pr-4">
                {info.title}
              </h2>
              <p className="text-[12px] font-bold uppercase tracking-widest text-primary/60 mt-1">
                Active Matter File
              </p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-6 py-2.5 rounded-full hover:bg-primary hover:text-primary-foreground transition-all font-bold tracking-widest uppercase text-[10px] shadow-sm shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              {isEditing ? "Cancel Edit" : "Edit Profile"}
            </button>
          </>
        }
        mainPaneContent={
          <div className="p-10 pb-20">
            <div className="grid grid-cols-1 gap-12">

              {/* ── Next Hearing ─────────────────────────────────── */}
              {nextHearing && (
                <div>
                  <h3 className="text-[12px] font-bold uppercase tracking-widest text-foreground flex items-center gap-3 mb-6 pb-2 border-b border-primary/10">
                    <span className="inline-block h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                    Next Hearing Schedule
                  </h3>
                  <div className="flex items-start gap-6 rounded-[2rem] border border-orange-500/20 bg-orange-500/5 p-6 shadow-sm">
                    <div className="flex flex-col items-center justify-center rounded-[1.5rem] bg-orange-500 text-white shadow-lg h-24 w-24 shrink-0 hover:scale-105 transition-transform">
                      <span className="text-[12px] font-bold uppercase tracking-widest opacity-90 mb-1">
                        {format(new Date(nextHearing.hearingDate), "MMM")}
                      </span>
                      <span className="text-[2.2rem] font-serif font-bold leading-none">
                        {format(new Date(nextHearing.hearingDate), "d")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pt-2">
                      <p className="font-serif text-[1.8rem] font-bold text-foreground leading-none truncate mb-2 text-orange-600 dark:text-orange-400">
                        {nextHearing.title}
                      </p>
                      <p className="text-[13px] text-foreground font-bold uppercase tracking-widest mb-3">
                        {format(new Date(nextHearing.hearingDate), "EEEE, d MMMM yyyy")}
                      </p>
                      {nextHearing.description && (
                        <p className="text-[14px] text-muted-foreground font-medium truncate bg-white/95 dark:bg-card/80 px-4 py-2 rounded-xl inline-block border border-primary/10">
                          {nextHearing.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Case Docket (Tasks) ─────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-6 pb-2 border-b border-primary/10">
                  <h3 className="text-[12px] font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    Case Docket
                  </h3>
                  <button
                    onClick={() => setTaskModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                  >
                    <Plus className="h-3 w-3" />
                    Append Task
                  </button>
                </div>

                <div className="rounded-[2rem] border border-white/50 dark:border-white/5 bg-white/70 dark:bg-card/80 shadow-inner overflow-hidden">
                  {pendingTasks.length === 0 && completedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                      <CheckCircle2 className="w-12 h-12 text-primary/30 mb-4" />
                      <p className="text-[14px] font-bold text-foreground">Docket is clear.</p>
                      <p className="text-[12px] text-muted-foreground mt-1">No pending actions for this matter.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-primary/5">
                      {pendingTasks.map((task) => {
                        const due = getDueLabel(task.dueDate);
                        return (
                          <div key={task.id} className="group flex items-center gap-4 px-6 py-4 hover:bg-white dark:hover:bg-white/5 transition-colors cursor-pointer">
                            <button
                              onClick={() => toggleCaseTaskStatus(task.id, task.status, caseId)}
                              className="h-5 w-5 rounded-full border-2 border-primary/30 shrink-0 hover:border-primary transition-colors flex items-center justify-center"
                            />
                            <div className="flex-1 min-w-0 pr-4 border-r border-primary/10">
                              <p className="text-[14px] font-bold text-foreground leading-snug group-hover:text-primary transition-colors">{task.description}</p>
                            </div>
                            <div className="w-24 shrink-0 flex items-center justify-end">
                              {due && (
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/5 ${due.cls}`}>
                                  {due.label}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => deleteCaseTask(task.id, caseId)}
                              className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                      {completedTasks.length > 0 && (
                        <div className="bg-black/5 dark:bg-card/80 px-6 py-4">
                          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Completed History</h4>
                          <div className="space-y-2">
                            {completedTasks.slice(0, 3).map((task) => (
                              <div key={task.id} className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity">
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                <p className="text-[13px] font-medium text-muted-foreground line-through truncate">{task.description}</p>
                              </div>
                            ))}
                            {completedTasks.length > 3 && (
                              <p className="text-[10px] font-bold uppercase tracking-widest text-primary pt-2 pl-7 cursor-pointer hover:underline">
                                View all {completedTasks.length} completed
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        }
      />

      {/* ── Add Task Modal ────────────────────────────────── */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-background rounded-[1.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-visible relative border border-white/60 dark:border-primary/20 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 bg-white dark:bg-lawdger-sidebar border-b border-primary/10">
              <h2 className="font-serif text-[1.5rem] font-bold text-gray-900 dark:text-white leading-none">Append Task</h2>
              <button
                onClick={() => { setTaskModalOpen(false); setDatePickerOpen(false); }}
                className="text-foreground/40 hover:text-foreground transition-colors p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Action Item Description
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTask.desc}
                  onChange={(e) => setNewTask({ ...newTask, desc: e.target.value })}
                  className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground"
                  placeholder="e.g. Draft reply affidavit"
                />
              </div>

              <div className="relative">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Target Deadline <span className="normal-case font-medium tracking-normal text-primary/60">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setDatePickerOpen(!datePickerOpen)}
                  className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary transition-all text-left flex justify-between items-center shadow-sm"
                >
                  <span className={newTask.due ? "text-foreground font-bold" : "text-muted-foreground/60"}>
                    {newTask.due
                      ? format(parse(newTask.due, "yyyy-MM-dd", new Date()), "d MMMM yyyy")
                      : "Open Deadline"}
                  </span>
                  <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                </button>

                {datePickerOpen && (
                  <div className="absolute top-full left-0 mt-2 p-5 bg-card border border-white/10 rounded-[1.5rem] shadow-2xl z-50 w-[300px] backdrop-blur-3xl">
                    <div className="flex justify-between items-center mb-5 border-b border-primary/10 pb-3">
                      <button type="button" onClick={() => setPickerMonth(subMonths(pickerMonth, 1))} className="p-1.5 hover:bg-white/40 rounded-full transition-colors bg-white/5">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="font-serif text-[16px] font-bold">{format(pickerMonth, "MMMM yyyy")}</span>
                      <button type="button" onClick={() => setPickerMonth(addMonths(pickerMonth, 1))} className="p-1.5 hover:bg-white/40 rounded-full transition-colors bg-white/5">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center mb-3">
                      {["S","M","T","W","T","F","S"].map((d, i) => (
                        <div key={i} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-[13px] font-medium">
                      {eachDayOfInterval({
                        start: startOfWeek(startOfMonth(pickerMonth)),
                        end:   endOfWeek(endOfMonth(pickerMonth)),
                      }).map((day, i) => {
                        const selected = newTask.due === format(day, "yyyy-MM-dd");
                        const inMonth  = isSameMonth(day, pickerMonth);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setNewTask({ ...newTask, due: format(day, "yyyy-MM-dd") }); setDatePickerOpen(false); }}
                            className={`p-2 rounded-full h-9 flex items-center justify-center transition-colors ${
                              selected ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(200,150,62,0.4)]" : inMonth ? "hover:bg-primary/10 text-foreground" : "text-muted-foreground/30 hover:bg-white/5"
                            }`}
                          >
                            {format(day, "d")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={taskSubmitting}
                  className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(200,150,62,0.3)] hover:scale-[1.01] transition-all uppercase tracking-widest text-[12px] disabled:opacity-60"
                >
                  {taskSubmitting ? "Writing to Docket…" : "Add to Docket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ── Helper sub-components ────────────────────────────────────────────────────

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-bold uppercase tracking-widest text-lawdger-cream/50 mb-1.5 ml-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-4 bg-white/5 rounded-2xl px-5 py-4 border border-white/5">
      <div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center text-white/70 shadow-inner shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-lawdger-cream/50 mb-0.5">
          {label}
        </p>
        <p className="text-[14px] font-bold text-lawdger-cream truncate">
          {value ?? <span className="text-white/30 italic text-[12px]">—</span>}
        </p>
      </div>
    </div>
  );
}
