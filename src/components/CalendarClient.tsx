"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Clock, MapPin, X, Trash2, CheckSquare, AlertCircle,
} from "lucide-react";
import {
  addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  format, isSameDay, isSameMonth, parse, isPast, isToday,
} from "date-fns";
import {
  createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
} from "@/actions/calendarActions";
import { createTask, updateTask, deleteTask } from "@/actions/taskActions";

type ViewMode = "day" | "week" | "month";

type DBEvent = {
  id: string;
  title: string;
  hearingDate: Date;
  description: string | null;
  caseId: string;
  case: { id: string; title: string };
};

type TaskItem = {
  id: string;
  description: string;
  dueDate: Date;
  case: { id: string; title: string } | null;
};

type CaseOption = { id: string; title: string };

const EVENT_COLOR   = "bg-orange-500/10 border-orange-500/20 text-orange-400";
const TASK_COLOR    = "bg-blue-500/10 border-blue-500/20 text-blue-400";
const OVERDUE_COLOR = "bg-red-500/10 border-red-500/20 text-red-400";

const TIME_SLOTS = [
  "09:00 AM","10:00 AM","11:00 AM","12:00 PM",
  "01:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM",
];

function toDisplayTime(date: Date): string {
  return format(date, "hh:mm aa").toUpperCase();
}

function buildDateFromDayAndTime(day: Date, timeStr: string): Date {
  try {
    return parse(timeStr, "hh:mm aa", day);
  } catch {
    return day;
  }
}

/* Compact chip for tasks — week, month and overflow tray */
function TaskChip({
  task,
  overdue = false,
  onClick,
}: {
  task: TaskItem;
  overdue?: boolean;
  onClick?: () => void;
}) {
  const color = overdue ? OVERDUE_COLOR : TASK_COLOR;
  const inner = (
    <>
      {overdue
        ? <AlertCircle className="h-3 w-3 shrink-0" />
        : <CheckSquare className="h-3 w-3 shrink-0" />}
      <span className="truncate">{task.description}</span>
      <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest border border-current rounded-full px-1.5 py-0.5 bg-background/60 ml-auto">
        {overdue ? "LATE" : "DUE"}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 rounded-lg border ${color} px-2 py-1 text-[10px] font-medium hover:opacity-80 transition-opacity truncate w-full text-left`}
      >
        {inner}
      </button>
    );
  }
  return (
    <Link
      href={task.case ? `/cases/${task.case.id}` : "/tasks"}
      className={`flex items-center gap-1.5 rounded-lg border ${color} px-2 py-1 text-[10px] font-medium hover:opacity-80 transition-opacity truncate`}
    >
      {inner}
    </Link>
  );
}

/* Full-slot card in day view — clicking opens edit modal */
function TaskSlotCard({
  task,
  overdue = false,
  onClick,
}: {
  task: TaskItem;
  overdue?: boolean;
  onClick: () => void;
}) {
  const border   = overdue ? "border-red-500/40"  : "border-blue-500/40";
  const bg       = overdue ? "bg-red-500/5 hover:bg-red-500/10"  : "bg-blue-500/5 hover:bg-blue-500/10";
  const iconClr  = overdue ? "text-red-400"  : "text-blue-400";
  const textClr  = overdue ? "text-red-300"  : "text-blue-300";
  const badgeBdr = overdue ? "border-red-500/40 text-red-400" : "border-blue-500/40 text-blue-400";
  return (
    <button
      onClick={onClick}
      className={`absolute inset-2 rounded-2xl border border-dashed ${border} ${bg} p-4 flex flex-col justify-between transition-colors cursor-pointer w-[calc(100%-16px)]`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {overdue
            ? <AlertCircle className={`h-3.5 w-3.5 shrink-0 ${iconClr}`} />
            : <CheckSquare className={`h-3.5 w-3.5 shrink-0 ${iconClr}`} />}
          <span className={`text-sm font-medium ${textClr} truncate leading-tight`}>{task.description}</span>
        </div>
        <span className={`shrink-0 text-[9px] font-bold uppercase tracking-widest border rounded-full px-1.5 py-0.5 bg-background/60 ml-1 ${badgeBdr}`}>
          {overdue ? "Overdue" : "To-do"}
        </span>
      </div>
      {task.case && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-light mt-2">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{task.case.title}</span>
        </div>
      )}
    </button>
  );
}

export default function CalendarClient({
  initialEvents,
  cases,
  tasks,
}: {
  initialEvents: DBEvent[];
  cases: CaseOption[];
  tasks: TaskItem[];
}) {
  const [view, setView] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);       // CalendarEvent being edited
  const [editTaskId, setEditTaskId] = useState<string | null>(null); // Task being edited
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: "hearing" as "hearing" | "task",
    title: "",
    time: "09:00 AM",
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    caseId: "",
  });

  const [pickerMonth, setPickerMonth] = useState(new Date());

  /* ── Helpers ── */
  const isTaskOverdue = (dueDate: Date) => !isToday(dueDate) && isPast(dueDate);

  /* ── Navigation ── */
  const prev = () => {
    if (view === "day")   setCurrentDate(subDays(currentDate, 1));
    else if (view === "week")  setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };
  const next = () => {
    if (view === "day")   setCurrentDate(addDays(currentDate, 1));
    else if (view === "week")  setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };

  /* ── Modal helpers ── */
  const openNew = (dateStr: string) => {
    setEditId(null);
    setEditTaskId(null);
    setForm({ type: "hearing", title: "", time: "09:00 AM", date: dateStr, description: "", caseId: cases[0]?.id ?? "" });
    setModalOpen(true);
  };

  const openEditHearing = (ev: DBEvent) => {
    setEditId(ev.id);
    setEditTaskId(null);
    setForm({
      type: "hearing",
      title: ev.title,
      time: toDisplayTime(ev.hearingDate),
      date: format(ev.hearingDate, "yyyy-MM-dd"),
      description: ev.description ?? "",
      caseId: ev.caseId,
    });
    setModalOpen(true);
  };

  const openEditTask = (task: TaskItem) => {
    setEditTaskId(task.id);
    setEditId(null);
    setForm({
      type: "task",
      title: task.description,
      time: "09:00 AM",
      date: format(task.dueDate, "yyyy-MM-dd"),
      description: "",
      caseId: task.case?.id ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditId(null); setEditTaskId(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (form.type === "task") {
      const caseIdVal = form.caseId || null;
      if (editTaskId) {
        await updateTask(editTaskId, {
          description: form.title,
          dueDate: form.date ? new Date(form.date) : null,
          caseId: caseIdVal,
        });
      } else {
        await createTask({
          caseId: caseIdVal ?? undefined,
          description: form.title,
          dueDate: form.date ? new Date(form.date) : undefined,
        });
      }
    } else {
      const hearingDate = buildDateFromDayAndTime(
        parse(form.date, "yyyy-MM-dd", new Date()),
        form.time,
      );
      if (editId) {
        await updateCalendarEvent(editId, { title: form.title, hearingDate, description: form.description || undefined });
      } else {
        await createCalendarEvent({ title: form.title, hearingDate, description: form.description || undefined, caseId: form.caseId });
      }
    }
    setIsSubmitting(false);
    closeModal();
  };

  const handleDelete = async () => {
    if (editTaskId) {
      await deleteTask(editTaskId);
    } else if (editId) {
      await deleteCalendarEvent(editId);
    }
    closeModal();
  };

  const isEditing = !!(editId || editTaskId);

  /* ── Drag & Drop ── */
  const handleDrop = async (e: React.DragEvent, targetDay: Date, targetTime?: string) => {
    e.preventDefault();
    if (!draggedId) return;
    const hearingDate = targetTime ? buildDateFromDayAndTime(targetDay, targetTime) : targetDay;
    await updateCalendarEvent(draggedId, { hearingDate });
    setDraggedId(null);
  };

  /* ── Derived ── */
  const weekStart  = startOfWeek(currentDate);
  const weekEnd    = endOfWeek(currentDate);
  const weekDays   = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const monthDays  = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end:   endOfWeek(endOfMonth(currentDate)),
  });
  const miniCalDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(pickerMonth)),
    end:   endOfWeek(endOfMonth(pickerMonth)),
  });

  const eventsOnDay     = (day: Date) => initialEvents.filter((ev) => isSameDay(ev.hearingDate, day));
  const eventsOnDayTime = (day: Date, time: string) =>
    initialEvents.filter((ev) => isSameDay(ev.hearingDate, day) && toDisplayTime(ev.hearingDate) === time);
  const tasksOnDay      = (day: Date) => tasks.filter((t) => isSameDay(t.dueDate, day));

  const hasOverdueTasks = tasks.some((t) => isTaskOverdue(t.dueDate));

  /**
   * Greedily assigns each task on `day` to the first free time slot (no event).
   * Tasks that don't fit go into the overflow list.
   */
  const autoAllocateTasks = (day: Date): { slotMap: Record<string, TaskItem>; overflow: TaskItem[] } => {
    const dayTasks = tasksOnDay(day);
    if (dayTasks.length === 0) return { slotMap: {}, overflow: [] };
    const slotMap: Record<string, TaskItem> = {};
    let taskIdx = 0;
    for (const time of TIME_SLOTS) {
      if (taskIdx >= dayTasks.length) break;
      if (eventsOnDayTime(day, time).length === 0) {
        slotMap[time] = dayTasks[taskIdx];
        taskIdx++;
      }
    }
    return { slotMap, overflow: dayTasks.slice(taskIdx) };
  };

  /* ── Event card ── */
  const EventCard = ({ ev, style }: { ev: DBEvent; style?: React.CSSProperties }) => (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); setDraggedId(ev.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={() => openEditHearing(ev)}
      className={`rounded-2xl border ${EVENT_COLOR} backdrop-blur-md p-4 shadow-lg transition-transform hover:-translate-y-0.5 cursor-pointer active:cursor-grabbing hover:shadow-xl`}
      style={style}
    >
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-serif text-base font-medium truncate pr-1">{ev.title}</h4>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest border border-current rounded-full px-2 py-0.5 bg-background/60">
          Hearing
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2 opacity-75 text-xs font-light">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{toDisplayTime(ev.hearingDate)}</span>
        {ev.case?.title && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.case.title}</span>}
      </div>
    </div>
  );

  return (
    <>
      {/* Header */}
      <div className="relative border-b border-white/5 bg-card/60 backdrop-blur-xl px-10 py-8 shrink-0 z-10 shadow-sm">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground mb-2">Schedule</h1>
            <p className="text-muted-foreground text-lg font-light">Manage your hearings, client meetings, and deadlines.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-1">
              {(["day","week","month"] as ViewMode[]).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-4 py-1.5 rounded-full text-sm capitalize transition-colors ${view === v ? "bg-white/10 font-medium text-foreground" : "font-light text-muted-foreground hover:text-foreground"}`}>
                  {v}
                </button>
              ))}
            </div>
            {cases.length > 0 && (
              <button
                onClick={() => openNew(format(currentDate, "yyyy-MM-dd"))}
                className="flex items-center gap-2 bg-accent text-accent-foreground px-6 py-2.5 rounded-full hover:scale-105 transition-transform font-medium shadow-[0_0_20px_rgba(243,225,215,0.2)]"
              >
                <Plus className="h-4 w-4" /> Add New
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-4 gap-8">

          {/* Left Sidebar */}
          <div className="space-y-6">
            {/* Mini Calendar */}
            <div className="rounded-3xl border border-white/5 bg-card/60 backdrop-blur-xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-lg font-medium">{format(pickerMonth, "MMMM yyyy")}</h3>
                <div className="flex gap-2">
                  <button onClick={() => setPickerMonth(subMonths(pickerMonth, 1))} className="p-1.5 rounded-full hover:bg-white/10 transition-colors"><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>
                  <button onClick={() => setPickerMonth(addMonths(pickerMonth, 1))} className="p-1.5 rounded-full hover:bg-white/10 transition-colors"><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["S","M","T","W","T","F","S"].map((d, i) => (
                  <div key={i} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-sm font-light">
                {miniCalDays.map((day, i) => {
                  const isSelected       = isSameDay(day, currentDate);
                  const inMonth          = isSameMonth(day, pickerMonth);
                  const hasEvent         = eventsOnDay(day).length > 0;
                  const dayTasks         = tasksOnDay(day);
                  const hasNormalTask    = dayTasks.some((t) => !isTaskOverdue(t.dueDate));
                  const hasOverdueTask   = dayTasks.some((t) => isTaskOverdue(t.dueDate));
                  return (
                    <div key={i} onClick={() => { setCurrentDate(day); setPickerMonth(day); setView("day"); }}
                      className={`p-2 rounded-full flex items-center justify-center cursor-pointer transition-colors relative ${isSelected ? "bg-accent text-accent-foreground font-medium shadow-[0_0_15px_rgba(243,225,215,0.3)]" : inMonth ? "hover:bg-white/5 text-foreground" : "text-muted-foreground/30 hover:bg-white/5"}`}>
                      {format(day, "d")}
                      {(hasEvent || hasNormalTask || hasOverdueTask) && !isSelected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {hasEvent       && <span className="h-1 w-1 rounded-full bg-orange-400" />}
                          {hasNormalTask  && <span className="h-1 w-1 rounded-full bg-blue-400" />}
                          {hasOverdueTask && <span className="h-1 w-1 rounded-full bg-red-400" />}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="rounded-3xl border border-white/5 bg-card/60 backdrop-blur-xl p-6 shadow-xl">
              <h3 className="font-serif text-lg font-medium mb-4">Legend</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded border border-orange-400 bg-orange-400/20 shrink-0" />
                  <span className="text-sm font-light text-muted-foreground">Hearings</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded border border-dashed border-blue-400 bg-blue-400/10 shrink-0" />
                  <span className="text-sm font-light text-muted-foreground">Tasks</span>
                </div>
                {hasOverdueTasks && (
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded border border-dashed border-red-400 bg-red-400/10 shrink-0" />
                    <span className="text-sm font-light text-red-400">Pending Tasks</span>
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Events & Tasks */}
            {(initialEvents.length > 0 || tasks.length > 0) && (
              <div className="rounded-3xl border border-white/5 bg-card/60 backdrop-blur-xl p-6 shadow-xl">
                <h3 className="font-serif text-lg font-medium mb-4">Upcoming</h3>
                <div className="space-y-3">
                  {initialEvents.slice(0, 3).map((ev) => (
                    <button key={ev.id} onClick={() => openEditHearing(ev)}
                      className="w-full text-left flex items-start gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors">
                      <div className="flex flex-col items-center justify-center bg-orange-500/10 border border-orange-500/20 rounded-xl h-11 w-11 shrink-0">
                        <span className="text-[9px] font-semibold text-orange-400 uppercase">{format(ev.hearingDate, "MMM")}</span>
                        <span className="text-base font-serif text-foreground leading-none">{format(ev.hearingDate, "d")}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ev.title}</p>
                        <p className="text-xs text-muted-foreground font-light">{toDisplayTime(ev.hearingDate)}</p>
                      </div>
                    </button>
                  ))}
                  {tasks.slice(0, 3).map((t) => {
                    const overdue = isTaskOverdue(t.dueDate);
                    return (
                      <Link key={t.id} href={t.case ? `/cases/${t.case.id}` : "/tasks"}
                        className="flex items-start gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors">
                        <div className={`flex flex-col items-center justify-center rounded-xl h-11 w-11 shrink-0 ${overdue ? "bg-red-500/10 border border-red-500/20" : "bg-blue-500/10 border border-blue-500/20"}`}>
                          <span className={`text-[9px] font-semibold uppercase ${overdue ? "text-red-400" : "text-blue-400"}`}>{format(t.dueDate, "MMM")}</span>
                          <span className="text-base font-serif text-foreground leading-none">{format(t.dueDate, "d")}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.description}</p>
                          <p className={`text-xs font-light ${overdue ? "text-red-400" : "text-blue-400"}`}>
                            {overdue ? "Overdue" : "Due"} · {t.case?.title ?? "Task"}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Main Calendar Area */}
          <div className="xl:col-span-3 rounded-3xl border border-white/5 bg-card/60 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden h-[800px]">
            {/* View Header */}
            <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-8 py-6 shrink-0">
              <h2 className="font-serif text-2xl font-medium flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-accent" />
                {view === "day"  ? format(currentDate, "EEEE, MMMM d, yyyy") :
                 view === "week" ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}` :
                 format(currentDate, "MMMM yyyy")}
              </h2>
              <div className="flex gap-2">
                <button onClick={prev} className="p-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={next} className="p-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors"><ChevronRight className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto relative">

              {/* ── Day View ── */}
              {view === "day" && (() => {
                const { slotMap, overflow } = autoAllocateTasks(currentDate);
                return (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-8 space-y-0">
                      {TIME_SLOTS.map((time, i) => {
                        const slotEvents    = eventsOnDayTime(currentDate, time);
                        const allocatedTask = slotEvents.length === 0 ? slotMap[time] : undefined;
                        return (
                          <div key={i} className="flex min-h-[100px] border-b border-white/5 group"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, currentDate, time)}>
                            <div className="w-24 shrink-0 pr-6 text-right">
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors relative top-2">{time}</span>
                            </div>
                            <div className="flex-1 border-l border-white/5 pl-6 pb-2 pt-2 relative">
                              {slotEvents.map((ev, idx) => (
                                <div key={ev.id} style={{ left: `${idx * 20 + 24}px`, zIndex: 10 + idx, right: "8px", bottom: "8px", position: "absolute", top: "8px" }}>
                                  <EventCard ev={ev} style={{ height: "100%" }} />
                                </div>
                              ))}
                              {allocatedTask && (
                                <TaskSlotCard
                                  task={allocatedTask}
                                  overdue={isTaskOverdue(allocatedTask.dueDate)}
                                  onClick={() => openEditTask(allocatedTask)}
                                />
                              )}
                              {slotEvents.length === 0 && !allocatedTask && (
                                <button onClick={() => openNew(format(currentDate, "yyyy-MM-dd"))}
                                  className="absolute inset-0 w-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-muted-foreground hover:text-accent">
                                  + Add hearing or task
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {overflow.length > 0 && (
                      <div className="shrink-0 border-t border-white/5 bg-blue-500/5 px-8 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 mb-2">
                          Unscheduled · {overflow.length} task{overflow.length > 1 ? "s" : ""}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {overflow.map((t) => (
                            <TaskChip key={t.id} task={t} overdue={isTaskOverdue(t.dueDate)} onClick={() => openEditTask(t)} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Week View ── */}
              {view === "week" && (
                <div className="flex flex-col h-full min-w-[800px]">
                  <div className="flex border-b border-white/5 sticky top-0 bg-card/90 backdrop-blur-md z-30">
                    <div className="w-20 shrink-0 border-r border-white/5" />
                    {weekDays.map((day, i) => {
                      const dayTasks = tasksOnDay(day);
                      return (
                        <div key={i} className={`flex-1 border-r border-white/5 last:border-0 ${isSameDay(day, new Date()) ? "bg-white/5" : ""}`}>
                          <div className="p-3 text-center border-b border-white/5">
                            <span className={`text-xs font-semibold uppercase tracking-widest ${isSameDay(day, new Date()) ? "text-accent" : "text-muted-foreground"}`}>
                              {format(day, "E d")}
                            </span>
                          </div>
                          {dayTasks.length > 0 && (
                            <div className="px-1 pb-1 space-y-0.5 bg-blue-500/5">
                              {dayTasks.map((t) => (
                                <TaskChip key={t.id} task={t} overdue={isTaskOverdue(t.dueDate)} onClick={() => openEditTask(t)} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-1">
                    {TIME_SLOTS.map((time, i) => (
                      <div key={i} className="flex border-b border-white/5 h-24">
                        <div className="w-20 shrink-0 border-r border-white/5 pr-3 text-right">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground relative top-2">{time}</span>
                        </div>
                        {weekDays.map((day, j) => {
                          const slotEvs = eventsOnDayTime(day, time);
                          return (
                            <div key={j} className="flex-1 border-r border-white/5 last:border-0 relative hover:bg-white/5 transition-colors"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDrop(e, day, time)}>
                              {slotEvs.map((ev) => (
                                <div key={ev.id} draggable
                                  onDragStart={(e) => { e.stopPropagation(); setDraggedId(ev.id); }}
                                  onClick={() => openEditHearing(ev)}
                                  className={`absolute inset-x-1 top-1 rounded-lg border ${EVENT_COLOR} p-2 z-10 overflow-hidden shadow-md cursor-pointer backdrop-blur-md`}
                                  style={{ height: "calc(100% - 8px)" }}>
                                  <p className="text-[10px] font-bold">{time}</p>
                                  <p className="text-xs font-medium leading-tight mt-0.5 line-clamp-2">{ev.title}</p>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Month View ── */}
              {view === "month" && (
                <div className="flex flex-col h-full min-w-[700px]">
                  <div className="grid grid-cols-7 border-b border-white/5 bg-white/5 sticky top-0 z-30">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => (
                      <div key={i} className="p-3 text-center border-r border-white/5 last:border-0">
                        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{d}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 grid-rows-5 flex-1">
                    {monthDays.map((day, i) => {
                      const dayEvs    = eventsOnDay(day);
                      const dayTasks  = tasksOnDay(day);
                      const todayFlag = isSameDay(day, new Date());
                      const inMonth   = isSameMonth(day, currentDate);
                      return (
                        <div key={i} className={`border-r border-b border-white/5 p-2 hover:bg-white/5 transition-colors flex flex-col min-h-[120px] ${!inMonth ? "bg-black/20" : ""}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDrop(e, day)}>
                          <div className="text-right mb-1">
                            <span onClick={() => { setCurrentDate(day); setView("day"); }}
                              className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm cursor-pointer ${todayFlag ? "bg-accent text-accent-foreground font-medium" : !inMonth ? "text-muted-foreground/30" : "text-muted-foreground hover:bg-white/10"}`}>
                              {format(day, "d")}
                            </span>
                          </div>
                          <div className="space-y-0.5 flex-1 overflow-hidden">
                            {dayEvs.map((ev) => (
                              <div key={ev.id} draggable
                                onDragStart={(e) => { e.stopPropagation(); setDraggedId(ev.id); }}
                                onClick={() => openEditHearing(ev)}
                                className={`text-[10px] font-medium px-2 py-1 rounded truncate border cursor-pointer ${EVENT_COLOR}`}>
                                {format(ev.hearingDate, "h:mm a")} {ev.title}
                              </div>
                            ))}
                            {dayTasks.map((t) => {
                              const overdue = isTaskOverdue(t.dueDate);
                              return (
                                <Link key={t.id} href={t.case ? `/cases/${t.case.id}` : "/tasks"}
                                  className={`text-[10px] font-medium px-2 py-1 rounded truncate border flex items-center gap-1 ${overdue ? OVERDUE_COLOR : TASK_COLOR}`}>
                                  {overdue
                                    ? <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                                    : <CheckSquare className="h-2.5 w-2.5 shrink-0" />}
                                  {t.description}
                                </Link>
                              );
                            })}
                            <button onClick={() => openNew(format(day, "yyyy-MM-dd"))}
                              className="w-full text-left text-[10px] text-muted-foreground/40 hover:text-accent transition-colors px-1">
                              + add
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-white/10 rounded-3xl shadow-2xl w-full max-w-md relative">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="font-serif text-2xl font-medium">
                {editId ? "Edit Hearing" : editTaskId ? "Edit Task" : "Add New"}
              </h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-white/5 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Type toggle — only for new entries (not edit mode) */}
              {!isEditing && (
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                  {(["hearing", "task"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, type: t })}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${form.type === t ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {t === "hearing" ? "🏛️ Hearing" : "✅ Task"}
                    </button>
                  ))}
                </div>
              )}

              {/* Title / Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {form.type === "task" ? "Description *" : "Hearing Title *"}
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  placeholder={form.type === "task" ? "e.g. Draft settlement agreement" : "e.g. Cross-examination hearing"}
                />
              </div>

              {/* Date + Time (hearing) / Due Date (task) */}
              <div className={form.type === "hearing" ? "grid grid-cols-2 gap-4" : ""}>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    {form.type === "task" ? "Due Date *" : "Date *"}
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  />
                </div>
                {form.type === "hearing" && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Time</label>
                    <select
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all appearance-none"
                    >
                      {TIME_SLOTS.map((ts) => <option key={ts} value={ts} className="bg-card">{ts}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Linked Case */}
              {cases.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Linked Case
                    {form.type === "task" && (
                      <span className="ml-2 normal-case font-normal tracking-normal text-muted-foreground/60">(optional)</span>
                    )}
                  </label>
                  <select
                    value={form.caseId}
                    onChange={(e) => setForm({ ...form, caseId: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all appearance-none"
                  >
                    {form.type === "task" && (
                      <option value="" className="bg-card">— No Case (Independent Task)</option>
                    )}
                    {cases.map((c) => <option key={c.id} value={c.id} className="bg-card">{c.title}</option>)}
                  </select>
                </div>
              )}

              {/* Notes — hearings only */}
              {form.type === "hearing" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Notes</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="Room number, bench details…"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                {isEditing && (
                  <button type="button" onClick={handleDelete}
                    className="flex items-center justify-center bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-3 rounded-xl hover:bg-red-500/20 transition-colors">
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 bg-accent text-accent-foreground font-medium py-3 rounded-xl hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-60">
                  {isSubmitting ? "Saving…"
                    : editId     ? "Update Hearing"
                    : editTaskId ? "Update Task"
                    : form.type === "task" ? "Save Task"
                    : "Save Hearing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
