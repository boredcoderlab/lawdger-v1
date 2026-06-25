"use client";

import { useState } from "react";
import {
  Plus, X, CheckCircle2, Trash2, Clock, AlertCircle,
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Pencil, Check, Briefcase, Building2, IndianRupee, FileText,
  StickyNote, BriefcaseBusiness, CheckSquare
} from "lucide-react";
import {
  format, isPast, isToday, isTomorrow, differenceInDays,
  subMonths, addMonths, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, parse,
} from "date-fns";
import { updateCase, updateCaseStatus, type CaseWithChildren } from "@/actions/caseActions";
import { createNote, deleteNote, updateNote } from "@/actions/noteActions";
import { NOTE_CATEGORIES, type NoteCategory } from "@/actions/noteActions.types";
import {
  createCaseTask,
  deleteCaseTask,
  toggleCaseTaskStatus,
} from "@/actions/taskActions";
import { CaseStatus, MatterType } from "@prisma/client";
import { CASE_TYPES, type CaseType } from "@/lib/case-constants";
import { PageLayout, DarkPaneHeaderTitle, ContentHeading } from "@/components/ui/LayoutShell";

// ── Types ────────────────────────────────────────────────────────────────────

type Task = {
  id: string;
  description: string;
  status: string;
  dueDate: Date | null;
  isUrgent: boolean;
  createdAt: Date;
};

type CalendarEvent = {
  id: string;
  title: string;
  hearingDate: Date;
  description: string | null;
};

const STATUS_OPTIONS = [CaseStatus.ACTIVE, CaseStatus.CLOSED] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const MATTER_TYPE_OPTIONS = [
  MatterType.LITIGATION,
  MatterType.ADVISORY,
  MatterType.PRE_LITIGATION,
] as const;

const CRIMINAL_CASE_TYPE: CaseType = "CRIMINAL";

const CATEGORY_COLOR: Record<string, { dot: string; badge: string }> = {
  "General Note":  { dot: "bg-blue-500",    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  "Client Update": { dot: "bg-purple-500",  badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  "Next Date":     { dot: "bg-orange-500",  badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  "Task":          { dot: "bg-primary",     badge: "bg-primary/10 text-primary border-primary/20" },
};

type TimelineItem =
  | { kind: "note";  id: string; date: Date; content: string; category: string; nextDate?: Date | null }
  | { kind: "task";  id: string; date: Date; description: string; status: string; dueDate: Date | null }
  | { kind: "event"; id: string; date: Date; title: string; description: string | null };

const titleCase = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, " ");

const titleCaseStatus = (s: Status) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const toDateInputValue = (d: Date | null) =>
  d ? new Date(d).toISOString().split("T")[0] : "";

const formatIndianDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// ── Component ────────────────────────────────────────────────────────────────

// Phase 3.5: initial* props own the original 5 fields (title/clientName/court/agreedFee/status).
// caseData owns the 9 Indian fields (caseNumber, caseType, matterType, nextHearingDate,
// description, filingDate, actsSections, firNumber, policeStation). Do not cross the streams.
export default function CaseDetailClient({
  caseId,
  initialTitle,
  initialClientName,
  initialCourtName,
  initialAgreedFee,
  initialStatus,
  initialTasks,
  upcomingHearings,
  caseData,
}: {
  caseId: string;
  initialTitle: string;
  initialClientName: string | null;
  initialCourtName: string | null;
  initialAgreedFee: number | null;
  initialStatus: string;
  initialTasks: Task[];
  upcomingHearings: CalendarEvent[];
  caseData: CaseWithChildren;
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

  // 9 Indian fields — sourced from caseData prop only (see header comment).
  const initialMatterData = {
    caseNumber:      caseData.caseNumber ?? "",
    matterType:      caseData.matterType,
    caseType:        (caseData.caseType ?? "") as CaseType | "",
    filingDate:      toDateInputValue(caseData.filingDate),
    nextHearingDate: toDateInputValue(caseData.nextHearingDate),
    description:     caseData.description ?? "",
    actsSections:    caseData.actsSections ?? "",
    firNumber:       caseData.firNumber ?? "",
    policeStation:   caseData.policeStation ?? "",
  };
  const [matterData, setMatterData] = useState(initialMatterData);

  const handleSave = async () => {
    setSaving(true);
    const isCriminal = matterData.caseType === CRIMINAL_CASE_TYPE;
    await updateCase(caseId, {
      title:           info.title || undefined,
      clientName:      info.clientName || undefined,
      court:           info.courtName || undefined,
      agreedFee:       info.agreedFee ? parseFloat(info.agreedFee) : undefined,
      caseNumber:      matterData.caseNumber || undefined,
      caseType:        matterData.caseType ? matterData.caseType : undefined,
      matterType:      matterData.matterType,
      filingDate:      matterData.filingDate ? new Date(matterData.filingDate) : undefined,
      nextHearingDate: matterData.nextHearingDate ? new Date(matterData.nextHearingDate) : undefined,
      description:     matterData.description || undefined,
      actsSections:    matterData.actsSections || undefined,
      firNumber:       isCriminal && matterData.firNumber ? matterData.firNumber : undefined,
      policeStation:   isCriminal && matterData.policeStation ? matterData.policeStation : undefined,
    });
    await updateCaseStatus(caseId, info.status);
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
    setMatterData(initialMatterData);
    setIsEditing(false);
  };

  // ── Tasks ───────────────────────────────────────────────────────────────────
  const [taskModalOpen,  setTaskModalOpen]  = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerMonth,    setPickerMonth]    = useState(new Date());
  const [newTask,        setNewTask]        = useState({ desc: "", due: "", isUrgent: false });
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
      isUrgent: newTask.isUrgent,
    });
    setNewTask({ desc: "", due: "", isUrgent: false });
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
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [deletingNoteId,      setDeletingNoteId]      = useState<string | null>(null);
  const [errorMsg,            setErrorMsg]            = useState<string | null>(null);

  // ── Note edit modal ─────────────────────────────────────────────────────────
  const [editNoteOpen,        setEditNoteOpen]        = useState(false);
  const [editingNoteId,       setEditingNoteId]       = useState<string | null>(null);
  const [editContent,         setEditContent]         = useState("");
  const [editCategory,        setEditCategory]        = useState<NoteCategory>("General Note");
  const [editNextDate,        setEditNextDate]        = useState<Date | null>(null);
  const [editSubmitting,      setEditSubmitting]      = useState(false);
  const [editError,           setEditError]           = useState<string | null>(null);
  const [editDatePickerOpen,  setEditDatePickerOpen]  = useState(false);
  const [editPickerMonth,     setEditPickerMonth]     = useState(new Date());

  const openEditNote = (item: TimelineItem & { kind: "note" }) => {
    setEditingNoteId(item.id);
    setEditContent(item.content);
    setEditCategory(item.category as NoteCategory);
    setEditNextDate(item.nextDate ?? null);
    setEditPickerMonth(item.nextDate ?? new Date());
    setEditError(null);
    setEditDatePickerOpen(false);
    setEditNoteOpen(true);
  };

  const closeEditNote = () => {
    setEditNoteOpen(false);
    setEditingNoteId(null);
    setEditContent("");
    setEditCategory("General Note");
    setEditNextDate(null);
    setEditError(null);
    setEditDatePickerOpen(false);
  };

  const handleEditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteId) return;
    if (!editContent.trim()) return;
    if (editCategory === "Next Date" && !editNextDate) return;
    setEditSubmitting(true);
    setEditError(null);
    const result = await updateNote({
      id: editingNoteId,
      caseId,
      cleanContent: editContent.trim(),
      category: editCategory,
      nextDate: editCategory === "Next Date" ? editNextDate : null,
    });
    setEditSubmitting(false);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    closeEditNote();
  };

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

  // ── Activity Timeline (merged notes + tasks + hearings, read-only) ─────────
  const timeline: TimelineItem[] = [
    ...caseData.notes.map((n) => ({
      kind: "note" as const,
      id: n.id,
      date: n.createdAt,
      content: n.cleanContent,
      category: n.category,
      nextDate: n.nextDate,
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
                              ? "bg-primary border-primary text-primary-foreground dark:bg-[var(--surface-3)] dark:border-[rgba(212,175,55,0.35)] dark:text-[var(--gold-text)] shadow-md"
                              : "border-white/10 text-white/50 hover:bg-white/5"
                          }`}
                        >
                          {titleCaseStatus(s)}
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
                      className="btn-gold flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save Profile"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white/5 ${
                        info.status === CaseStatus.ACTIVE
                          ? 'text-primary border-primary/30 dark:text-[var(--gold-text)] dark:border-[rgba(212,175,55,0.35)]'
                          : 'text-white/40 border-white/10'
                    }`}>
                      {titleCaseStatus(info.status)}
                    </span>
                  </div>
                  <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Client Identifier" value={info.clientName || null} />
                  <InfoRow icon={<Building2  className="h-4 w-4" />} label="Court / Jurisdiction" value={info.courtName  || null} />
                  <InfoRow
                    icon={<IndianRupee className="h-4 w-4" />}
                    label="Agreed Fee Structure"
                    value={info.agreedFee ? `₹${parseFloat(info.agreedFee).toLocaleString("en-IN")}` : null}
                  />
                  <MatterDetails caseData={caseData} />
                </div>
              )}
            </div>

            {/* Quick Case Notes */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/50 dark:text-muted-foreground mb-3 ml-2">Quick Case Notes</h3>
              {noteOpen ? (
                <form onSubmit={handleAddNote} className="space-y-3">
                  <textarea
                    autoFocus
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={3}
                    placeholder="Drop a quick thought..."
                    className="w-full bg-black/20 dark:bg-[var(--surface-2)] border border-white/5 rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none shadow-inner"
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
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-4 rounded-xl bg-black/20 dark:bg-[var(--surface-2)] border border-white/5 dark:border-[var(--border)] text-[12px] font-bold uppercase tracking-widest text-white/50 hover:text-white dark:hover:border-[rgba(212,175,55,0.3)] transition-all group"
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
            <ContentHeading>{info.title}</ContentHeading>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn-ghost-gold flex items-center gap-2 px-6 py-2.5 rounded-full transition-all font-bold tracking-widest uppercase text-[10px] shadow-sm shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              {isEditing ? "Cancel Edit" : "Edit Profile"}
            </button>
          </>
        }
        mainPaneContent={
          <div className="h-full overflow-y-auto scrollbar-hide p-10 pb-20">
            <div className="grid grid-cols-1 gap-12">

              {/* ── Matter Details (Editing) ────────────────────── */}
              {isEditing && (
                <div className="rounded-[2rem] border border-primary/20 bg-primary/5 p-6">
                  <h3 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-6">
                    Matter Details (Editing)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <EditField label="Case Number" tone="light">
                      <input
                        value={matterData.caseNumber}
                        onChange={(e) => setMatterData({ ...matterData, caseNumber: e.target.value })}
                        placeholder="Court-assigned number (e.g. W.P. 1234/2026)"
                        className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/50"
                      />
                    </EditField>
                    <EditField label="Matter Type" tone="light">
                      <select
                        value={matterData.matterType}
                        onChange={(e) => setMatterData({ ...matterData, matterType: e.target.value as MatterType })}
                        className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-primary transition-all shadow-sm appearance-none"
                      >
                        {MATTER_TYPE_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {titleCase(m)}
                          </option>
                        ))}
                      </select>
                    </EditField>
                    <EditField label="Case Type" tone="light">
                      <select
                        value={matterData.caseType}
                        onChange={(e) => setMatterData({ ...matterData, caseType: e.target.value as CaseType | "" })}
                        className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-primary transition-all shadow-sm appearance-none"
                      >
                        <option value="">Select type</option>
                        {CASE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {titleCase(t)}
                          </option>
                        ))}
                      </select>
                    </EditField>
                    <EditField label="Filing Date" tone="light">
                      <input
                        type="date"
                        value={matterData.filingDate}
                        onChange={(e) => setMatterData({ ...matterData, filingDate: e.target.value })}
                        className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-primary transition-all shadow-sm"
                      />
                    </EditField>
                    <EditField label="Next Hearing Date" tone="light">
                      <input
                        type="date"
                        value={matterData.nextHearingDate}
                        onChange={(e) => setMatterData({ ...matterData, nextHearingDate: e.target.value })}
                        className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-primary transition-all shadow-sm"
                      />
                    </EditField>
                    <div className="sm:col-span-2">
                      <EditField label="Description" tone="light">
                        <textarea
                          rows={3}
                          value={matterData.description}
                          onChange={(e) => setMatterData({ ...matterData, description: e.target.value })}
                          className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-primary transition-all shadow-sm resize-none placeholder:text-muted-foreground/50"
                        />
                      </EditField>
                    </div>
                    <div className="sm:col-span-2">
                      <EditField label="Acts & Sections" tone="light">
                        <input
                          value={matterData.actsSections}
                          onChange={(e) => setMatterData({ ...matterData, actsSections: e.target.value })}
                          placeholder="Pipe-delimited, e.g. IPC § 420 | CrPC § 173"
                          className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/50"
                        />
                      </EditField>
                    </div>
                    {matterData.caseType === CRIMINAL_CASE_TYPE && (
                      <>
                        <EditField label="FIR Number" tone="light">
                          <input
                            value={matterData.firNumber}
                            onChange={(e) => setMatterData({ ...matterData, firNumber: e.target.value })}
                            className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-primary transition-all shadow-sm"
                          />
                        </EditField>
                        <EditField label="Police Station" tone="light">
                          <input
                            value={matterData.policeStation}
                            onChange={(e) => setMatterData({ ...matterData, policeStation: e.target.value })}
                            className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-primary transition-all shadow-sm"
                          />
                        </EditField>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Activity Timeline ─────────────────────────────────── */}
              <div>
                {errorMsg && (
                  <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 mb-4 text-[13px] font-medium text-destructive">
                    <span>{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="shrink-0 text-destructive/70 hover:text-destructive transition-colors"><X className="h-4 w-4" /></button>
                  </div>
                )}
                <div className="flex items-center justify-between mb-6 pb-2 border-b border-primary/10">
                  <h3 className="text-[12px] font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(200,150,62,0.5)]" />
                    Case Timeline
                  </h3>
                  {timeline.length > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {timeline.length} {timeline.length === 1 ? "entry" : "entries"}
                    </span>
                  )}
                </div>

                {timeline.length === 0 ? (
                  <div className="rounded-[2rem] border border-dashed border-primary/15 bg-white/40 dark:bg-card/30 p-10 text-center text-[13px] font-medium text-muted-foreground">
                    No activity yet. Add a task, note, or hearing to get started.
                  </div>
                ) : (
                  <div className="relative border-l border-primary/15 ml-3 space-y-4 pb-2">
                    {timeline.map((item) => {
                      if (item.kind === "event") {
                        return (
                          <div key={item.id} className="relative pl-8">
                            <div className="absolute -left-3.5 top-1.5 h-7 w-7 flex items-center justify-center rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                              <CalendarIcon className="h-3.5 w-3.5" />
                            </div>
                            <div className="rounded-2xl border border-primary/10 bg-white/80 dark:bg-card/60 backdrop-blur-md px-5 py-4 shadow-sm hover:border-orange-500/30 transition-colors">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">
                                    Hearing
                                  </span>
                                  <p className="font-serif text-base font-bold text-foreground mt-1 leading-snug">
                                    {item.title}
                                  </p>
                                  {item.description && (
                                    <p className="text-[13px] text-muted-foreground font-medium mt-1">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest shrink-0 mt-0.5">
                                  {format(item.date, "d MMM yyyy")}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (item.kind === "task") {
                        const done = item.status === "completed";
                        return (
                          <div key={item.id} className={`relative pl-8 ${done ? "opacity-50" : ""}`}>
                            <div className={`absolute -left-3.5 top-1.5 h-7 w-7 flex items-center justify-center rounded-full border ${
                              done
                                ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30"
                                : "bg-primary/15 text-primary border-primary/30"
                            }`}>
                              <CheckSquare className="h-3.5 w-3.5" />
                            </div>
                            <div className="rounded-2xl border border-primary/10 bg-white/80 dark:bg-card/60 backdrop-blur-md px-5 py-4 shadow-sm transition-colors">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <span className={`text-[10px] font-bold uppercase tracking-widest ${done ? "text-green-600 dark:text-green-400" : "text-primary"}`}>
                                    {done ? "Done" : "Task"}
                                  </span>
                                  <p className={`text-[13px] font-medium mt-1 leading-relaxed ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                    {item.description}
                                  </p>
                                </div>
                                {item.dueDate && (
                                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest shrink-0 mt-0.5">
                                    Due {format(item.dueDate, "d MMM yyyy")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const colors = CATEGORY_COLOR[item.category] ?? CATEGORY_COLOR["General Note"];
                      const isConfirming = confirmDeleteNoteId === item.id;
                      const isDeleting   = deletingNoteId === item.id;
                      return (
                        <div key={item.id} className="relative pl-8 group">
                          <div className={`absolute -left-2 top-2.5 h-4 w-4 rounded-full border-2 border-background ${colors.dot}`} />
                          <div className="relative rounded-2xl border border-primary/10 bg-white/80 dark:bg-card/60 backdrop-blur-md px-5 py-4 shadow-sm hover:border-primary/20 transition-colors">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${colors.badge}`}>
                                  {item.category}
                                </span>
                                {item.category === "Next Date" && (
                                  item.nextDate != null
                                    ? <span className="text-[10px] text-muted-foreground font-medium">· {formatIndianDate(item.nextDate)}</span>
                                    : <span className="text-[10px] text-muted-foreground/60 font-medium">· date not set</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                  {format(item.date, "d MMM yyyy")}
                                </span>
                                <button
                                  onClick={() => openEditNote(item)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary dark:hover:text-[var(--gold-text)]"
                                  aria-label="Edit note"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteNoteId(item.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                  aria-label="Delete note"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[13px] font-medium text-foreground leading-relaxed">
                              {item.content}
                            </p>
                            {isConfirming && (
                              <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3 bg-card/95 backdrop-blur-sm border border-destructive/30 px-5 py-4">
                                <p className="text-[12px] font-bold text-destructive uppercase tracking-widest">Delete this note?</p>
                                <p className="text-[11px] text-muted-foreground text-center">This also removes any linked calendar event.</p>
                                <div className="flex gap-2">
                                  <button
                                    disabled={isDeleting}
                                    onClick={async () => {
                                      setDeletingNoteId(item.id);
                                      const result = await deleteNote(item.id, caseId);
                                      setDeletingNoteId(null);
                                      setConfirmDeleteNoteId(null);
                                      if (!result.ok) setErrorMsg(result.error);
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                                  >
                                    {isDeleting ? "Deleting…" : "Confirm delete"}
                                  </button>
                                  <button
                                    disabled={isDeleting}
                                    onClick={() => setConfirmDeleteNoteId(null)}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-primary/20 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

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
                    className="btn-ghost-gold flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
                  >
                    <Plus className="h-3 w-3" />
                    Append Task
                  </button>
                </div>

                <div className="surface-card surface-inner rounded-[2rem] border border-white/50 bg-white/70 shadow-inner overflow-hidden">
                  {pendingTasks.length === 0 && completedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                      <CheckCircle2 className="w-12 h-12 text-primary/30 dark:text-[rgba(212,175,55,0.3)] mb-4" />
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
                              <div className="flex items-center gap-2">
                                <p className="text-[14px] font-bold text-foreground leading-snug group-hover:text-primary transition-colors">{task.description}</p>
                                {task.isUrgent && (
                                  <span
                                    className="inline-flex items-center rounded-full bg-lawdger-gold/15 dark:bg-[var(--surface-inset)] text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 shrink-0"
                                    style={{ color: "var(--gold-text, var(--accent-gold))" }}
                                  >
                                    Urgent
                                  </span>
                                )}
                              </div>
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
                        <div className="bg-black/5 dark:bg-[var(--surface-inset)] px-6 py-4">
                          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Completed History</h4>
                          <div className="space-y-2">
                            {completedTasks.slice(0, 3).map((task) => (
                              <div key={task.id} className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity">
                                <CheckCircle2 className="h-4 w-4 text-primary dark:text-[var(--gold-text)] shrink-0" />
                                <p className="text-[13px] font-medium text-muted-foreground line-through truncate">{task.description}</p>
                              </div>
                            ))}
                            {completedTasks.length > 3 && (
                              <p className="text-[10px] font-bold uppercase tracking-widest text-primary dark:text-[var(--gold-text)] pt-2 pl-7 cursor-pointer hover:underline">
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
            <div className="flex justify-between items-center p-6 bg-white dark:bg-[var(--surface-2)] border-b border-primary/10 dark:border-[var(--border)]">
              <h2 className="font-serif text-[1.5rem] font-bold text-gray-900 dark:text-foreground leading-none">Append Task</h2>
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
                  className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary dark:focus:border-[var(--gold)] focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground"
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
                  className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary dark:focus:border-[var(--gold)] transition-all text-left flex justify-between items-center shadow-sm"
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
                              selected ? "bg-primary text-primary-foreground dark:bg-[var(--surface-3)] dark:text-[var(--gold-text)] shadow-[0_0_15px_rgba(200,150,62,0.4)] dark:shadow-none" : inMonth ? "hover:bg-primary/10 text-foreground" : "text-muted-foreground/30 hover:bg-white/5"
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

              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newTask.isUrgent}
                    onChange={(e) => setNewTask({ ...newTask, isUrgent: e.target.checked })}
                    className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary/30"
                  />
                  <span className="text-[12.5px] font-medium text-foreground">
                    Mark as urgent
                  </span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={taskSubmitting}
                  className="btn-gold w-full py-4 rounded-xl font-bold uppercase tracking-widest text-[12px] disabled:opacity-60"
                >
                  {taskSubmitting ? "Writing to Docket…" : "Add to Docket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Note Modal ──────────────────────────────── */}
      {editNoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-background rounded-[1.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-visible relative border border-white/60 dark:border-primary/20 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 bg-white dark:bg-[var(--surface-2)] border-b border-primary/10 dark:border-[var(--border)]">
              <h2 className="font-serif text-[1.5rem] font-bold text-gray-900 dark:text-foreground leading-none">Edit Note</h2>
              <button
                onClick={closeEditNote}
                className="text-foreground/40 hover:text-foreground transition-colors p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditNote} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Note Content
                </label>
                <textarea
                  required
                  autoFocus
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary dark:focus:border-[var(--gold)] focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground resize-none"
                  placeholder="Note content"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => {
                    const next = e.target.value as NoteCategory;
                    setEditCategory(next);
                    if (next !== "Next Date") setEditDatePickerOpen(false);
                  }}
                  className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary dark:focus:border-[var(--gold)] focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground"
                >
                  {NOTE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {editCategory === "Next Date" && (
                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Next Date
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditDatePickerOpen(!editDatePickerOpen)}
                    className="w-full bg-white dark:bg-[var(--surface-inset)] border border-primary/10 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary dark:focus:border-[var(--gold)] transition-all text-left flex justify-between items-center shadow-sm"
                  >
                    <span className={editNextDate ? "text-foreground font-bold" : "text-muted-foreground/60"}>
                      {editNextDate ? format(editNextDate, "d MMMM yyyy") : "Pick a date"}
                    </span>
                    <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                  </button>

                  {editDatePickerOpen && (
                    <div className="absolute top-full left-0 mt-2 p-5 bg-card border border-white/10 rounded-[1.5rem] shadow-2xl z-50 w-[300px] backdrop-blur-3xl">
                      <div className="flex justify-between items-center mb-5 border-b border-primary/10 pb-3">
                        <button type="button" onClick={() => setEditPickerMonth(subMonths(editPickerMonth, 1))} className="p-1.5 hover:bg-white/40 rounded-full transition-colors bg-white/5">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="font-serif text-[16px] font-bold">{format(editPickerMonth, "MMMM yyyy")}</span>
                        <button type="button" onClick={() => setEditPickerMonth(addMonths(editPickerMonth, 1))} className="p-1.5 hover:bg-white/40 rounded-full transition-colors bg-white/5">
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
                          start: startOfWeek(startOfMonth(editPickerMonth)),
                          end:   endOfWeek(endOfMonth(editPickerMonth)),
                        }).map((day, i) => {
                          const selected = !!editNextDate && format(editNextDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
                          const inMonth  = isSameMonth(day, editPickerMonth);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => { setEditNextDate(day); setEditDatePickerOpen(false); }}
                              className={`p-2 rounded-full h-9 flex items-center justify-center transition-colors ${
                                selected ? "bg-primary text-primary-foreground dark:bg-[var(--surface-3)] dark:text-[var(--gold-text)] shadow-[0_0_15px_rgba(200,150,62,0.4)] dark:shadow-none" : inMonth ? "hover:bg-primary/10 text-foreground" : "text-muted-foreground/30 hover:bg-white/5"
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
              )}

              {editError && (
                <p className="text-[12px] font-medium text-destructive">{editError}</p>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={closeEditNote}
                  disabled={editSubmitting}
                  className="flex-1 py-4 rounded-xl font-bold uppercase tracking-widest text-[12px] border border-primary/20 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    editSubmitting ||
                    !editContent.trim() ||
                    (editCategory === "Next Date" && !editNextDate)
                  }
                  className="btn-gold flex-1 py-4 rounded-xl font-bold uppercase tracking-widest text-[12px] disabled:opacity-60"
                >
                  {editSubmitting ? "Saving…" : "Save Changes"}
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

function EditField({
  label,
  children,
  tone = "dark",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "dark" | "light";
}) {
  return (
    <div>
      <label
        className={`block text-[9px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${
          tone === "light"
            ? "text-muted-foreground"
            : "text-lawdger-cream/50 dark:text-foreground-secondary"
        }`}
      >
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
        <p className="text-[9px] font-bold uppercase tracking-widest text-lawdger-cream/50 dark:text-foreground-secondary mb-0.5">
          {label}
        </p>
        <p className="text-[14px] font-bold text-lawdger-cream dark:text-foreground truncate">
          {value ?? <span className="text-white/30 italic text-[12px]">—</span>}
        </p>
      </div>
    </div>
  );
}

function DetailLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/50 dark:text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="flex-1 min-w-0 text-[13px] font-medium text-lawdger-cream dark:text-foreground text-right truncate">
        {children}
      </span>
    </p>
  );
}

function MatterDetails({ caseData }: { caseData: CaseWithChildren }) {
  // matterType excluded — it defaults to LITIGATION and is never absent,
  // so including it here would make hasAny always true.
  const hasAny =
    caseData.caseNumber ||
    caseData.caseType ||
    caseData.nextHearingDate ||
    caseData.filingDate ||
    caseData.description ||
    caseData.actsSections ||
    caseData.firNumber ||
    caseData.policeStation;
  if (!hasAny) return null;

  return (
    <div className="pt-4 mt-2 border-t border-white/10 space-y-2.5">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/70 dark:text-muted-foreground mb-3">
        Matter Details
      </h4>
      {caseData.caseNumber && <DetailLine label="Case No.">{caseData.caseNumber}</DetailLine>}
      {caseData.caseType && <DetailLine label="Type">{titleCase(caseData.caseType)}</DetailLine>}
      {caseData.matterType && <DetailLine label="Matter">{titleCase(caseData.matterType)}</DetailLine>}
      {caseData.filingDate && <DetailLine label="Filing Date">{formatIndianDate(caseData.filingDate)}</DetailLine>}
      {caseData.nextHearingDate && <DetailLine label="Next Hearing">{formatIndianDate(caseData.nextHearingDate)}</DetailLine>}
      {caseData.description && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/50 dark:text-muted-foreground mb-1">
            Description
          </p>
          <p className="text-[13px] font-medium text-lawdger-cream/90 dark:text-foreground leading-relaxed">
            {caseData.description}
          </p>
        </div>
      )}
      {caseData.actsSections && <DetailLine label="Acts & Sections">{caseData.actsSections}</DetailLine>}
      {caseData.firNumber && <DetailLine label="FIR No.">{caseData.firNumber}</DetailLine>}
      {caseData.policeStation && <DetailLine label="Police Station">{caseData.policeStation}</DetailLine>}
    </div>
  );
}
