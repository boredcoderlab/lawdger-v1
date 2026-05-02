"use client";

import { useState } from "react";
import {
  Plus, X, CheckCircle2, Trash2, Clock, AlertCircle,
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Pencil, Check, Briefcase, Building2, IndianRupee, FileText,
  StickyNote,
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
  active:   "bg-green-500/10 text-green-400 border-green-500/20",
  inactive: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  closed:   "bg-white/5 text-muted-foreground border-white/10",
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
    if (isToday(date))    return { label: "Today",    cls: "text-orange-400" };
    if (isTomorrow(date)) return { label: "Tomorrow", cls: "text-yellow-400" };
    if (isPast(date))     return { label: "Overdue",  cls: "text-red-400" };
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
    <div className="flex flex-col gap-5">

      {/* ── Next Hearing ─────────────────────────────────── */}
      {nextHearing && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />
            Next Hearing
          </h3>
          <div className="flex items-start gap-4 rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/8 to-transparent p-5 shadow-sm">
            <div className="flex flex-col items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20 h-14 w-14 shrink-0">
              <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400">
                {format(new Date(nextHearing.hearingDate), "MMM")}
              </span>
              <span className="text-2xl font-serif font-bold text-orange-300 leading-tight">
                {format(new Date(nextHearing.hearingDate), "d")}
              </span>
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="font-serif text-base font-medium text-foreground leading-snug truncate">
                {nextHearing.title}
              </p>
              {nextHearing.description && (
                <p className="text-sm text-muted-foreground font-light mt-0.5 truncate">
                  {nextHearing.description}
                </p>
              )}
              <p className="text-xs text-orange-400/70 mt-1.5">
                {format(new Date(nextHearing.hearingDate), "EEEE, d MMMM yyyy")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Case Details ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/20" />
            Case Details
          </h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden">
          {isEditing ? (
            <div className="p-5 space-y-3">
              {/* Edit fields */}
              <EditField label="Case Title">
                <input
                  value={info.title}
                  onChange={(e) => setInfo({ ...info, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-all"
                />
              </EditField>
              <EditField label="Client">
                <input
                  value={info.clientName}
                  onChange={(e) => setInfo({ ...info, clientName: e.target.value })}
                  placeholder="e.g. Amit Gupta"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-all"
                />
              </EditField>
              <EditField label="Court / Forum">
                <input
                  value={info.courtName}
                  onChange={(e) => setInfo({ ...info, courtName: e.target.value })}
                  placeholder="e.g. High Court of Delhi"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-all"
                />
              </EditField>
              <EditField label="Agreed Fee">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={info.agreedFee}
                    onChange={(e) => setInfo({ ...info, agreedFee: e.target.value })}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-all"
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
                      className={`flex-1 py-1.5 rounded-xl text-xs font-medium capitalize border transition-colors ${
                        info.status === s
                          ? STATUS_STYLES[s]
                          : "border-white/10 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </EditField>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              <div className="px-5 py-3.5 flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[info.status as Status] ?? STATUS_STYLES.active}`}>
                  {info.status}
                </span>
              </div>
              <InfoRow icon={<Briefcase className="h-3.5 w-3.5" />} label="Client"     value={info.clientName || null} />
              <InfoRow icon={<Building2  className="h-3.5 w-3.5" />} label="Court"      value={info.courtName  || null} />
              <InfoRow
                icon={<IndianRupee className="h-3.5 w-3.5" />}
                label="Agreed Fee"
                value={info.agreedFee ? `₹${parseFloat(info.agreedFee).toLocaleString("en-IN")}` : null}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Tasks ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/20" />
            Tasks
          </h3>
          {pendingTasks.length > 0 && (
            <span className="text-xs bg-accent/10 text-accent border border-accent/20 rounded-full px-2 py-0.5 font-medium">
              {pendingTasks.length} pending
            </span>
          )}
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden">
          {pendingTasks.length === 0 && completedTasks.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground font-light">No tasks yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {pendingTasks.map((task) => {
                const due = getDueLabel(task.dueDate);
                return (
                  <div key={task.id} className="group flex items-start gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors">
                    <button
                      onClick={() => toggleCaseTaskStatus(task.id, task.status, caseId)}
                      className="mt-0.5 h-4 w-4 rounded-full border border-white/25 shrink-0 hover:border-accent transition-colors"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-light text-foreground/90 leading-snug">{task.description}</p>
                      {due && (
                        <p className={`text-xs mt-0.5 flex items-center gap-1 ${due.cls}`}>
                          {due.label === "Overdue" ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {due.label}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteCaseTask(task.id, caseId)}
                      className="p-1 text-muted-foreground hover:text-red-400 rounded-full transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              {completedTasks.length > 0 && (
                <>
                  {completedTasks.slice(0, 2).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3 opacity-40">
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                      <p className="text-sm font-light text-muted-foreground line-through truncate">{task.description}</p>
                    </div>
                  ))}
                  {completedTasks.length > 2 && (
                    <p className="px-4 py-2 text-xs text-muted-foreground/40 font-light">
                      +{completedTasks.length - 2} more completed
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <div className="border-t border-white/5 px-4 py-3">
            <button
              onClick={() => setTaskModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-accent hover:bg-accent/5 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </button>
          </div>
        </div>
      </div>

      {/* ── Add Note ─────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/20" />
          Add a Note
        </h3>
        <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden">
          {noteOpen ? (
            <form onSubmit={handleAddNote} className="p-4 space-y-3">
              <textarea
                autoFocus
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={3}
                placeholder="Write your note here…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setNoteOpen(false); setNoteContent(""); }}
                  className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground rounded-xl hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={noteSubmitting || !noteContent.trim()}
                  className="flex-1 bg-accent text-white text-xs font-medium py-2 rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-60"
                >
                  {noteSubmitting ? "Saving…" : "Save Note"}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setNoteOpen(true)}
              className="w-full flex items-center gap-2.5 px-5 py-4 text-sm font-light text-muted-foreground hover:bg-white/5 transition-colors"
            >
              <StickyNote className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              Write a note…
            </button>
          )}
        </div>
      </div>

      {/* ── Add Task Modal ────────────────────────────────── */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-visible relative">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="font-serif text-2xl font-medium">Add Task</h2>
              <button
                onClick={() => { setTaskModalOpen(false); setDatePickerOpen(false); }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Description
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTask.desc}
                  onChange={(e) => setNewTask({ ...newTask, desc: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  placeholder="e.g. Draft reply affidavit"
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Due Date <span className="normal-case font-normal tracking-normal text-muted-foreground/60">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setDatePickerOpen(!datePickerOpen)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-all text-left flex justify-between items-center"
                >
                  <span className={newTask.due ? "text-foreground" : "text-muted-foreground/60"}>
                    {newTask.due
                      ? format(parse(newTask.due, "yyyy-MM-dd", new Date()), "d MMM yyyy")
                      : "No date set"}
                  </span>
                  <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>

                {datePickerOpen && (
                  <div className="absolute top-full left-0 mt-2 p-4 bg-card border border-white/10 rounded-2xl shadow-2xl z-50 w-[280px] backdrop-blur-3xl">
                    <div className="flex justify-between items-center mb-4">
                      <button type="button" onClick={() => setPickerMonth(subMonths(pickerMonth, 1))} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="font-serif text-sm font-medium">{format(pickerMonth, "MMMM yyyy")}</span>
                      <button type="button" onClick={() => setPickerMonth(addMonths(pickerMonth, 1))} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                      {["S","M","T","W","T","F","S"].map((d, i) => (
                        <div key={i} className="text-[10px] font-medium text-muted-foreground">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
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
                            className={`p-2 rounded-full text-xs transition-colors flex items-center justify-center ${
                              selected ? "bg-accent text-white font-medium" : inMonth ? "hover:bg-white/10 text-foreground" : "text-muted-foreground/30"
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

              <button
                type="submit"
                disabled={taskSubmitting}
                className="w-full mt-2 bg-accent text-white font-medium py-3 rounded-xl hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-60"
              >
                {taskSubmitting ? "Saving…" : "Save Task"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper sub-components ────────────────────────────────────────────────────

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
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
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-muted-foreground/50 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
          {label}
        </p>
        <p className="text-sm font-light text-foreground/90 truncate">
          {value ?? <span className="text-muted-foreground/30 italic text-xs">—</span>}
        </p>
      </div>
    </div>
  );
}
