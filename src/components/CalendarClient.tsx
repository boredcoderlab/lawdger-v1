"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Clock, MapPin, X, Trash2, CheckSquare, AlertCircle,
  LayoutGrid
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
import { PageLayout, DarkPaneHeaderTitle, ContentHeading } from "@/components/ui/LayoutShell";

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
          <span className={`text-[13px] font-medium ${textClr} truncate leading-tight`}>{task.description}</span>
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
  const [editId, setEditId] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
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
    if (view === "day")        setCurrentDate(subDays(currentDate, 1));
    else if (view === "week")  setCurrentDate(subWeeks(currentDate, 1));
    else                       setCurrentDate(subMonths(currentDate, 1));
  };
  const next = () => {
    if (view === "day")        setCurrentDate(addDays(currentDate, 1));
    else if (view === "week")  setCurrentDate(addWeeks(currentDate, 1));
    else                       setCurrentDate(addMonths(currentDate, 1));
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
      className={`rounded-xl border ${EVENT_COLOR} bg-orange-500/5 backdrop-blur-md p-3 shadow-md transition-transform hover:-translate-y-0.5 cursor-pointer active:cursor-grabbing hover:shadow-lg`}
      style={style}
    >
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-serif text-[14px] font-medium truncate pr-1 text-orange-400">{ev.title}</h4>
        <span className="shrink-0 text-[8px] font-bold uppercase tracking-widest border border-orange-400/50 rounded-full px-2 py-0.5 bg-orange-500/10">
          Hearing
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1.5 opacity-80 text-[10px] font-medium text-orange-400/80">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{toDisplayTime(ev.hearingDate)}</span>
        {ev.case?.title && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{ev.case.title}</span>}
      </div>
    </div>
  );

  return (
    <>
      <PageLayout
        pageTitle="Calendar"
        headerAction={
          <button
            onClick={() => openNew(format(currentDate, "yyyy-MM-dd"))}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3 rounded-full hover:scale-[1.02] transition-transform font-bold tracking-widest uppercase text-[12px] shadow-[0_0_20px_rgba(200,150,62,0.3)]"
          >
            <Plus className="h-4 w-4" />
            Book Slot
          </button>
        }
        darkPaneHeader={
          <DarkPaneHeaderTitle
            icon={LayoutGrid}
            title="Navigator"
            subtitle="Month & Legend"
          />
        }
        darkPaneContent={
          <>
            {/* Mini Calendar */}
            <div className="bg-black/20 dark:bg-card/80 rounded-[2rem] p-6 shadow-inner border border-white/5 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-[18px] font-bold text-lawdger-cream">{format(pickerMonth, "MMMM yyyy")}</h3>
                <div className="flex gap-1">
                  <button onClick={() => setPickerMonth(subMonths(pickerMonth, 1))} className="p-2 rounded-full hover:bg-white/40 transition-colors">
                    <ChevronLeft className="h-4 w-4 text-lawdger-cream/70" />
                  </button>
                  <button onClick={() => setPickerMonth(addMonths(pickerMonth, 1))} className="p-2 rounded-full hover:bg-white/40 transition-colors">
                    <ChevronRight className="h-4 w-4 text-lawdger-cream/70" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-3">
                {["S","M","T","W","T","F","S"].map((d, i) => (
                  <div key={i} className="text-[10px] font-bold text-lawdger-cream/40 uppercase tracking-widest">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-[13px] font-medium text-lawdger-cream">
                {miniCalDays.map((day, i) => {
                  const isSelected     = isSameDay(day, currentDate);
                  const inMonth        = isSameMonth(day, pickerMonth);
                  const hasEvent       = eventsOnDay(day).length > 0;
                  const dayTasks       = tasksOnDay(day);
                  const hasNormalTask  = dayTasks.some((t) => !isTaskOverdue(t.dueDate));
                  const hasOverdueTask = dayTasks.some((t) => isTaskOverdue(t.dueDate));
                  return (
                    <div key={i}
                      onClick={() => { setCurrentDate(day); setPickerMonth(day); setView("day"); }}
                      className={`p-2 rounded-full flex items-center justify-center cursor-pointer transition-colors relative h-10 ${
                        isSelected ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(200,150,62,0.5)]"
                          : inMonth ? "hover:bg-white/40"
                          : "text-white/20 hover:bg-white/5"
                      }`}
                    >
                      {format(day, "d")}
                      {(hasEvent || hasNormalTask || hasOverdueTask) && !isSelected && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
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
            <div className="space-y-4 text-[12px] font-medium text-lawdger-cream/70">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]" />
                <span>Hearings & Appointments</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
                <span>Deadlines & Tasks</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]" />
                <span>Overdue Items</span>
              </div>
            </div>
          </>
        }
        mainPaneHeader={
          <>
            <ContentHeading>
              {view === "day"  ? format(currentDate, "EEEE, MMMM d, yyyy") :
               view === "week" ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}` :
               format(currentDate, "MMMM yyyy")}
            </ContentHeading>
            <div className="flex gap-4 items-center">
              <div className="flex bg-black/5 dark:bg-white/5 rounded-full p-1 border border-white/10">
                {(["day","week","month"] as ViewMode[]).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-4 py-1.5 rounded-full text-[12px] capitalize font-bold transition-all ${view === v ? "bg-primary text-primary-foreground shadow-sm scale-105" : "text-muted-foreground hover:text-foreground"}`}>
                    {v}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={prev} className="p-2 rounded-full border border-white/20 dark:border-white/10 bg-white/70 dark:bg-card/80 hover:bg-white/95 transition-colors shadow-sm">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={next} className="p-2 rounded-full border border-white/20 dark:border-white/10 bg-white/70 dark:bg-card/80 hover:bg-white/95 transition-colors shadow-sm">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        }
        mainPaneContent={
          <div className="h-full overflow-y-auto scrollbar-hide relative">

            {/* ── Day View ── */}
            {view === "day" && (() => {
              const { slotMap } = autoAllocateTasks(currentDate);
              return (
                <div className="flex flex-col bg-transparent">
                  <div className="p-6 space-y-0">
                    {TIME_SLOTS.map((time, i) => {
                      const slotEvents    = eventsOnDayTime(currentDate, time);
                      const allocatedTask = slotEvents.length === 0 ? slotMap[time] : undefined;
                      return (
                        <div key={i} className="flex min-h-[110px] border-b border-primary/10 group relative"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDrop(e, currentDate, time)}>
                          <div className="w-24 shrink-0 pr-6 text-right">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 group-hover:text-primary transition-colors relative top-3">{time}</span>
                          </div>
                          <div className="flex-1 border-l border-primary/10 pl-6 pb-2 pt-2 relative">
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
                                className="absolute inset-0 w-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[12px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl">
                                + Book Slot
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Week View ── */}
            {view === "week" && (
              <div className="flex flex-col min-w-[800px] bg-transparent">
                <div className="flex border-b border-primary/10 sticky top-0 bg-white/95 dark:bg-white/5 backdrop-blur-md z-30">
                  <div className="w-20 shrink-0 border-r border-primary/10" />
                  {weekDays.map((day, i) => {
                    const dayTasks = tasksOnDay(day);
                    return (
                      <div key={i} className={`flex-1 border-r border-primary/10 last:border-0 ${isSameDay(day, new Date()) ? "bg-primary/5" : ""}`}>
                        <div className="p-3 text-center border-b border-primary/10">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground"}`}>
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
                    <div key={i} className="flex border-b border-primary/10 h-28">
                      <div className="w-20 shrink-0 border-r border-primary/10 pr-3 text-right">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 relative top-3">{time}</span>
                      </div>
                      {weekDays.map((day, j) => {
                        const slotEvs = eventsOnDayTime(day, time);
                        return (
                          <div key={j} className="flex-1 border-r border-primary/10 last:border-0 relative hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, day, time)}>
                            {slotEvs.map((ev) => (
                              <div key={ev.id} draggable
                                onDragStart={(e) => { e.stopPropagation(); setDraggedId(ev.id); }}
                                onClick={() => openEditHearing(ev)}
                                className={`absolute inset-1 rounded-xl border ${EVENT_COLOR} bg-orange-500/10 p-2 z-10 overflow-hidden shadow-sm cursor-pointer backdrop-blur-md`}
                                style={{ height: "calc(100% - 8px)" }}>
                                <p className="text-[9px] font-bold text-orange-400 mb-0.5">{time}</p>
                                <p className="text-[11px] font-medium leading-tight text-orange-600 dark:text-orange-300 line-clamp-3">{ev.title}</p>
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
              <div className="flex flex-col min-w-[700px] bg-transparent">
                <div className="grid grid-cols-7 border-b border-primary/10 bg-white/95 dark:bg-white/5 backdrop-blur-md sticky top-0 z-30">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => (
                    <div key={i} className="p-3 text-center border-r border-primary/10 last:border-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{d}</span>
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
                      <div key={i} className={`border-r border-b border-primary/10 p-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex flex-col min-h-[140px] ${!inMonth ? "bg-black/5 dark:bg-card/80" : ""}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, day)}>
                        <div className="text-right mb-1">
                          <span onClick={() => { setCurrentDate(day); setView("day"); }}
                            className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-[13px] font-medium cursor-pointer ${todayFlag ? "bg-primary text-primary-foreground shadow-md" : !inMonth ? "text-muted-foreground/40" : "text-foreground hover:bg-primary/10"}`}>
                            {format(day, "d")}
                          </span>
                        </div>
                        <div className="space-y-1 flex-1 overflow-hidden px-1">
                          {dayEvs.map((ev) => (
                            <div key={ev.id} draggable
                              onDragStart={(e) => { e.stopPropagation(); setDraggedId(ev.id); }}
                              onClick={() => openEditHearing(ev)}
                              className={`text-[10px] font-bold px-2 py-1.5 rounded-lg truncate border cursor-pointer ${EVENT_COLOR} bg-orange-500/10`}>
                              {format(ev.hearingDate, "h:mm")} {ev.title}
                            </div>
                          ))}
                          {dayTasks.map((t) => {
                            const overdue = isTaskOverdue(t.dueDate);
                            return (
                              <Link key={t.id} href={t.case ? `/cases/${t.case.id}` : "/tasks"}
                                className={`text-[10px] font-bold px-2 py-1.5 rounded-lg truncate border flex items-center gap-1.5 ${overdue ? OVERDUE_COLOR : TASK_COLOR} ${overdue ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                                {overdue
                                  ? <AlertCircle className="h-3 w-3 shrink-0" />
                                  : <CheckSquare className="h-3 w-3 shrink-0" />}
                                {t.description}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        }
      />

      {/* ── Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-background rounded-[1.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden relative border border-white/60 dark:border-primary/20 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 bg-white dark:bg-lawdger-sidebar border-b border-primary/10">
              <h2 className="font-serif text-[1.5rem] font-bold text-gray-900 dark:text-white leading-none">
                {editId ? "Edit Hearing" : editTaskId ? "Edit Task" : "Add New Slot"}
              </h2>
              <button onClick={closeModal} className="text-foreground/40 hover:text-foreground p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              {!isEditing && (
                <div className="flex bg-black/5 dark:bg-white/5 border border-primary/10 rounded-xl p-1">
                  {(["hearing", "task"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, type: t })}
                      className={`flex-1 py-3 rounded-lg text-[12px] font-bold uppercase tracking-widest transition-all ${form.type === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {t === "hearing" ? "Hearing" : "Task"}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  {form.type === "task" ? "Description *" : "Hearing Title *"}
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground"
                />
              </div>

              <div className={form.type === "hearing" ? "grid grid-cols-2 gap-4" : ""}>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    {form.type === "task" ? "Due Date *" : "Date *"}
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground"
                  />
                </div>
                {form.type === "hearing" && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Time</label>
                    <select
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground appearance-none"
                    >
                      {TIME_SLOTS.map((ts) => <option key={ts} value={ts} className="bg-card">{ts}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {cases.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Linked Case
                    {form.type === "task" && (
                      <span className="ml-2 normal-case font-medium tracking-normal text-primary/60">(optional)</span>
                    )}
                  </label>
                  <select
                    value={form.caseId}
                    onChange={(e) => setForm({ ...form, caseId: e.target.value })}
                    className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground appearance-none"
                  >
                    {form.type === "task" && (
                      <option value="" className="bg-card">— No Case (Independent Task)</option>
                    )}
                    {cases.map((c) => <option key={c.id} value={c.id} className="bg-card">{c.title}</option>)}
                  </select>
                </div>
              )}

              {form.type === "hearing" && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Notes</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm text-foreground resize-none"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {isEditing && (
                  <button type="button" onClick={handleDelete}
                    className="flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/20 px-5 py-3 rounded-xl hover:bg-red-500/20 transition-colors">
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 bg-primary text-primary-foreground font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(200,150,62,0.3)] hover:scale-[1.01] transition-all uppercase tracking-widest text-[12px] disabled:opacity-60">
                  {isSubmitting ? "Saving…" : "Confirm Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
