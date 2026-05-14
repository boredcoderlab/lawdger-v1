"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Briefcase,
  Calendar as CalendarIcon,
  FileText,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  differenceInCalendarDays,
  format,
  isPast,
  isToday,
  startOfWeek,
} from "date-fns";
import {
  PageLayout,
  DarkPaneHeaderTitle,
  ContentHeading,
} from "@/components/ui/LayoutShell";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────
type TaskPriority = "urgent" | "normal" | "low";
type TaskColumn = "my-plate" | "associates" | "clerks";

type Task = {
  id: string;
  title: string;
  caseName: string;
  caseId: string;
  dueDate: Date | null;
  priority: TaskPriority;
  column: TaskColumn;
  completed: boolean;
};

type ItemsState = Record<TaskColumn, Task[]>;
type AssignmentFilter = "all" | "mine" | "out";
type PriorityFilter = "all" | TaskPriority;

const COLUMNS: { id: TaskColumn; label: string; subtitle: string }[] = [
  { id: "my-plate", label: "My Plate", subtitle: "Assigned to you" },
  { id: "associates", label: "Associates", subtitle: "Delegated to lawyers" },
  { id: "clerks", label: "Clerks & Filings", subtitle: "Admin & filing team" },
];

const COLUMN_ICON: Record<TaskColumn, React.ElementType> = {
  "my-plate": Briefcase,
  associates: Users,
  clerks: FileText,
};

// ──────────────────────────────────────────────────────────────────────────
// Mock seed data — realistic Indian litigation tasks
// ──────────────────────────────────────────────────────────────────────────
const today = new Date();
const days = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};

const SEED: ItemsState = {
  "my-plate": [
    {
      id: "t1",
      title: "Draft counter-affidavit — Reliance vs Future Retail",
      caseName: "Reliance vs Future Retail",
      caseId: "c-reliance",
      dueDate: days(-2),
      priority: "urgent",
      column: "my-plate",
      completed: false,
    },
    {
      id: "t2",
      title: "Prepare oral arguments on Section 9 application",
      caseName: "Sharma vs Sharma (Arb.)",
      caseId: "c-sharma",
      dueDate: days(0),
      priority: "urgent",
      column: "my-plate",
      completed: false,
    },
    {
      id: "t3",
      title: "Review trial court order — note grounds for appeal",
      caseName: "TechCorp Suit — Civil 247/2024",
      caseId: "c-techcorp",
      dueDate: days(3),
      priority: "normal",
      column: "my-plate",
      completed: false,
    },
  ],
  associates: [
    {
      id: "t4",
      title: "Research case law on Section 138 NI Act — territorial jurisdiction",
      caseName: "HDFC Bank — Cheque Bounce Batch",
      caseId: "c-hdfc",
      dueDate: days(1),
      priority: "normal",
      column: "associates",
      completed: false,
    },
    {
      id: "t5",
      title: "Draft rejoinder to written statement",
      caseName: "Mehta Builders vs MCD",
      caseId: "c-mehta",
      dueDate: days(5),
      priority: "normal",
      column: "associates",
      completed: false,
    },
    {
      id: "t6",
      title: "Compile authorities for stay application hearing",
      caseName: "Patel Industries — Writ 8821/2025",
      caseId: "c-patel",
      dueDate: days(7),
      priority: "low",
      column: "associates",
      completed: false,
    },
  ],
  clerks: [
    {
      id: "t7",
      title: "File vakalatnama and process fee — DHC Bench V",
      caseName: "Sharma Associates",
      caseId: "c-sharma2",
      dueDate: days(-1),
      priority: "urgent",
      column: "clerks",
      completed: false,
    },
    {
      id: "t8",
      title: "Pay court fee and obtain receipt for plaint",
      caseName: "TechCorp Suit — Civil 247/2024",
      caseId: "c-techcorp",
      dueDate: days(2),
      priority: "normal",
      column: "clerks",
      completed: false,
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────
function findColumnOf(items: ItemsState, id: string): TaskColumn | null {
  if ((Object.keys(items) as TaskColumn[]).includes(id as TaskColumn)) {
    return id as TaskColumn;
  }
  for (const col of Object.keys(items) as TaskColumn[]) {
    if (items[col].some((t) => t.id === id)) return col;
  }
  return null;
}

function findTask(items: ItemsState, id: string): Task | null {
  for (const col of Object.keys(items) as TaskColumn[]) {
    const t = items[col].find((x) => x.id === id);
    if (t) return t;
  }
  return null;
}

function dueLabel(d: Date | null): string {
  if (!d) return "No due date";
  if (isToday(d)) return "Today";
  if (isPast(d)) return "Overdue";
  const diff = differenceInCalendarDays(d, new Date());
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return `In ${diff} days`;
  return format(d, "MMM d");
}

function dueChipClasses(d: Date | null): string {
  if (!d) return "text-lawdger-muted bg-lawdger-muted/10 border-lawdger-muted/20";
  if (isToday(d))
    return "text-lawdger-gold bg-lawdger-gold/10 border-lawdger-gold/30";
  if (isPast(d))
    return "text-destructive bg-destructive/10 border-destructive/30";
  return "text-lawdger-muted bg-lawdger-muted/10 border-lawdger-muted/20";
}

function priorityDotClasses(p: TaskPriority): string {
  if (p === "urgent") return "bg-destructive shadow-[0_0_8px_rgba(220,38,38,0.6)]";
  if (p === "normal") return "bg-lawdger-gold shadow-[0_0_8px_rgba(212,175,55,0.5)]";
  return "bg-lawdger-muted/60";
}

// ──────────────────────────────────────────────────────────────────────────
// Sortable Task Card
// ──────────────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  hidden,
  onClick,
}: {
  task: Task;
  hidden: boolean;
  onClick: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task.id)}
      className={[
        hidden ? "hidden" : "block",
        "group relative bg-lawdger-cream border border-lawdger-border/20 rounded-2xl p-4",
        "shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150",
        "cursor-grab active:cursor-grabbing",
      ].join(" ")}
    >
      {/* priority dot */}
      <div
        className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${priorityDotClasses(
          task.priority
        )}`}
        aria-label={`${task.priority} priority`}
      />

      <h4 className="font-bold text-[14px] text-lawdger-espresso leading-snug mb-3 pr-6">
        {task.title}
      </h4>

      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center bg-lawdger-espresso/10 text-lawdger-espresso text-[10px] font-semibold px-2 py-1 rounded-md max-w-[60%] truncate">
          {task.caseName}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${dueChipClasses(
            task.dueDate
          )}`}
        >
          <CalendarIcon className="w-3 h-3" />
          {dueLabel(task.dueDate)}
        </span>
      </div>
    </div>
  );
}

// Read-only card used inside DragOverlay
function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="rotate-2 bg-lawdger-cream border border-lawdger-border/30 rounded-2xl p-4 shadow-xl shadow-lawdger-espresso/30 w-full">
      <div
        className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${priorityDotClasses(
          task.priority
        )}`}
      />
      <h4 className="font-bold text-[14px] text-lawdger-espresso leading-snug mb-3 pr-6">
        {task.title}
      </h4>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center bg-lawdger-espresso/10 text-lawdger-espresso text-[10px] font-semibold px-2 py-1 rounded-md max-w-[60%] truncate">
          {task.caseName}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${dueChipClasses(
            task.dueDate
          )}`}
        >
          <CalendarIcon className="w-3 h-3" />
          {dueLabel(task.dueDate)}
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Droppable Column
// ──────────────────────────────────────────────────────────────────────────
function Column({
  id,
  label,
  tasks,
  visibleIds,
  hiddenIds,
  onAdd,
  onCardClick,
}: {
  id: TaskColumn;
  label: string;
  tasks: Task[];
  visibleIds: Set<string>;
  hiddenIds: Set<string>;
  onAdd: (col: TaskColumn) => void;
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const Icon = COLUMN_ICON[id];
  const visibleCount = tasks.filter((t) => visibleIds.has(t.id)).length;

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex flex-col h-full min-h-0 rounded-2xl border transition-colors",
        isOver
          ? "bg-lawdger-base/40 border-lawdger-gold/40"
          : "bg-transparent border-lawdger-espresso/10",
      ].join(" ")}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-lawdger-espresso/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-lawdger-espresso/10 flex items-center justify-center text-lawdger-espresso">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <h3 className="font-bold text-[15px] text-lawdger-espresso tracking-tight">
            {label}
          </h3>
          <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-5 rounded-full bg-lawdger-espresso text-lawdger-cream text-[10px] font-bold px-1.5">
            {visibleCount}
          </span>
        </div>
        <button
          onClick={() => onAdd(id)}
          aria-label={`Add task to ${label}`}
          className="w-7 h-7 rounded-full bg-lawdger-espresso/5 hover:bg-lawdger-gold/20 text-lawdger-espresso hover:text-lawdger-gold flex items-center justify-center transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Column body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-3 flex flex-col gap-3">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              hidden={hiddenIds.has(t.id)}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {visibleCount === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[120px] rounded-xl border-2 border-dashed border-lawdger-espresso/15 text-center px-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-muted">
              Drop tasks here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────
export default function TasksClient() {
  const [items, setItems] = useState<ItemsState>(SEED);
  const [activeId, setActiveId] = useState<string | null>(null);

  // filters
  const [assignFilter, setAssignFilter] = useState<AssignmentFilter>("all");
  const [caseFilter, setCaseFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [search, setSearch] = useState("");

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultCol, setModalDefaultCol] = useState<TaskColumn>("my-plate");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ── derived stats ────────────────────────────────────────────────────────
  const allTasks = useMemo(
    () => (Object.keys(items) as TaskColumn[]).flatMap((k) => items[k]),
    [items]
  );

  const stats = useMemo(() => {
    const pending = allTasks.filter((t) => !t.completed);
    const todayList = pending.filter((t) => t.dueDate && isToday(t.dueDate));
    const overdue = pending.filter(
      (t) => t.dueDate && isPast(t.dueDate) && !isToday(t.dueDate)
    );
    const weekStart = startOfWeek(new Date());
    const completedThisWeek = allTasks.filter(
      (t) => t.completed && t.dueDate && t.dueDate >= weekStart
    );
    return {
      pending: pending.length,
      today: todayList.length,
      overdue: overdue.length,
      completedThisWeek: completedThisWeek.length,
    };
  }, [allTasks]);

  const uniqueCases = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of allTasks) seen.set(t.caseId, t.caseName);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [allTasks]);

  // ── filtering ────────────────────────────────────────────────────────────
  const matchesFilter = (t: Task): boolean => {
    if (assignFilter === "mine" && t.column !== "my-plate") return false;
    if (
      assignFilter === "out" &&
      !(t.column === "associates" || t.column === "clerks")
    )
      return false;
    if (caseFilter !== "all" && t.caseId !== caseFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (
      search.trim() &&
      !`${t.title} ${t.caseName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    )
      return false;
    return true;
  };

  const visibleIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of allTasks) if (matchesFilter(t)) s.add(t.id);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTasks, assignFilter, caseFilter, priorityFilter, search]);

  const hiddenIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of allTasks) if (!visibleIds.has(t.id)) s.add(t.id);
    return s;
  }, [allTasks, visibleIds]);

  // ── dnd handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeCol = findColumnOf(items, activeId);
    const overCol = findColumnOf(items, overId);
    if (!activeCol || !overCol || activeCol === overCol) return;

    setItems((prev) => {
      const activeList = [...prev[activeCol]];
      const overList = [...prev[overCol]];
      const activeIdx = activeList.findIndex((t) => t.id === activeId);
      if (activeIdx === -1) return prev;

      const [moved] = activeList.splice(activeIdx, 1);
      moved.column = overCol;

      // if dropping on the column itself, append
      const overIdx =
        overId === overCol
          ? overList.length
          : overList.findIndex((t) => t.id === overId);
      const insertAt = overIdx === -1 ? overList.length : overIdx;
      overList.splice(insertAt, 0, moved);

      return {
        ...prev,
        [activeCol]: activeList,
        [overCol]: overList,
      };
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const activeCol = findColumnOf(items, activeId);
    const overCol = findColumnOf(items, overId);
    if (!activeCol || !overCol) return;

    if (activeCol === overCol) {
      const list = items[activeCol];
      const oldIdx = list.findIndex((t) => t.id === activeId);
      const newIdx = list.findIndex((t) => t.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      setItems((prev) => ({
        ...prev,
        [activeCol]: arrayMove(prev[activeCol], oldIdx, newIdx),
      }));
    }
  };

  const handleDragCancel = () => setActiveId(null);

  // ── modal / create ───────────────────────────────────────────────────────
  const openModal = (col: TaskColumn = "my-plate") => {
    setModalDefaultCol(col);
    setModalOpen(true);
  };

  const handleCreate = (data: {
    title: string;
    caseId: string;
    caseName: string;
    dueDate: Date | null;
    priority: TaskPriority;
    column: TaskColumn;
  }) => {
    const newTask: Task = {
      id: `t-${Date.now()}`,
      title: data.title,
      caseName: data.caseName,
      caseId: data.caseId,
      dueDate: data.dueDate,
      priority: data.priority,
      column: data.column,
      completed: false,
    };
    setItems((prev) => ({
      ...prev,
      [data.column]: [newTask, ...prev[data.column]],
    }));
    setModalOpen(false);
  };

  const handleCardClick = (id: string) => {
    // detail modal stub
    // eslint-disable-next-line no-console
    console.log("[tasks] open detail for", id);
  };

  const activeTask = activeId ? findTask(items, activeId) : null;

  // ──────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <PageLayout
        pageTitle="Tasks"
        headerAction={
          <button
            onClick={() => openModal("my-plate")}
            className="flex items-center gap-2 bg-lawdger-espresso text-lawdger-cream px-6 py-3 rounded-full text-[12px] font-bold tracking-widest uppercase shadow-lg hover:bg-lawdger-sidebar transition-colors"
          >
            <Plus className="w-4 h-4 text-lawdger-gold" />
            New Task
          </button>
        }
        darkPaneHeader={
          <DarkPaneHeaderTitle
            icon={Activity}
            title="Orchestration"
            subtitle="Metrics & Delegation"
          />
        }
        darkPaneContent={
          <div className="flex flex-col gap-6">
            {/* Stat tiles */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-lawdger-cream/10 border border-lawdger-cream/10 rounded-2xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/50 mb-2">
                  Total Pending
                </p>
                <p className="text-[2.5rem] font-bold text-lawdger-cream leading-none">
                  {stats.pending}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-lawdger-sidebar border border-lawdger-cream/5 rounded-2xl p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-lawdger-cream/40 mb-2">
                    Due Today
                  </p>
                  <p className="text-[1.6rem] font-bold text-lawdger-gold leading-none">
                    {stats.today}
                  </p>
                </div>
                <div className="bg-lawdger-sidebar border border-lawdger-cream/5 rounded-2xl p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-lawdger-cream/40 mb-2 flex items-center gap-1.5">
                    Overdue
                    {stats.overdue > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_6px_rgba(220,38,38,0.7)]" />
                    )}
                  </p>
                  <p
                    className={`text-[1.6rem] font-bold leading-none ${
                      stats.overdue > 0 ? "text-destructive" : "text-lawdger-cream/70"
                    }`}
                  >
                    {stats.overdue}
                  </p>
                </div>
              </div>

              <div className="bg-lawdger-sidebar border border-lawdger-cream/5 rounded-2xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-lawdger-cream/40 mb-2">
                  Completed This Week
                </p>
                <p className="text-[1.4rem] font-bold text-lawdger-cream leading-none">
                  {stats.completedThisWeek}
                </p>
              </div>
            </div>

            {/* Filter section */}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/40">
                Filter By
              </p>

              {/* Pill toggles */}
              <div className="flex gap-2">
                {(
                  [
                    { v: "all" as const, label: "All" },
                    { v: "mine" as const, label: "Mine" },
                    { v: "out" as const, label: "Assigned Out" },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setAssignFilter(opt.v)}
                    className={[
                      "flex-1 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors border",
                      assignFilter === opt.v
                        ? "bg-lawdger-gold text-lawdger-espresso border-lawdger-gold"
                        : "bg-transparent text-lawdger-cream/70 border-lawdger-cream/10 hover:border-lawdger-cream/30",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Case dropdown */}
              <select
                value={caseFilter}
                onChange={(e) => setCaseFilter(e.target.value)}
                className="w-full bg-lawdger-sidebar border border-lawdger-cream/10 rounded-xl px-3 py-2.5 text-[12px] text-lawdger-cream focus:outline-none focus:border-lawdger-gold/40 appearance-none"
              >
                <option value="all">All cases</option>
                {uniqueCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Priority pills */}
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { v: "all" as const, label: "All" },
                    { v: "urgent" as const, label: "Urgent" },
                    { v: "normal" as const, label: "Normal" },
                    { v: "low" as const, label: "Low" },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setPriorityFilter(opt.v)}
                    className={[
                      "px-2 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-colors border",
                      priorityFilter === opt.v
                        ? "bg-lawdger-cream text-lawdger-espresso border-lawdger-cream"
                        : "bg-transparent text-lawdger-cream/60 border-lawdger-cream/10 hover:border-lawdger-cream/30",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick search */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/40 mb-2">
                Quick Search
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-lawdger-cream/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  className="w-full bg-lawdger-sidebar border border-lawdger-cream/10 rounded-xl pl-9 pr-3 py-2.5 text-[12px] text-lawdger-cream placeholder:text-lawdger-cream/30 focus:outline-none focus:border-lawdger-gold/40"
                />
              </div>
            </div>
          </div>
        }
        mainPaneHeader={
          <>
            <div className="flex items-center gap-3">
              <ContentHeading className="text-lawdger-espresso">
                Active Assignments
              </ContentHeading>
              <span className="bg-lawdger-gold/15 text-lawdger-espresso text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-lawdger-gold/30">
                Kanban
              </span>
            </div>
            <span className="text-[11px] font-semibold text-lawdger-muted">
              {visibleIds.size} of {allTasks.length} visible
            </span>
          </>
        }
        mainPaneContent={
          <div className="p-6 lg:p-8 h-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-0">
              {COLUMNS.map((c) => (
                <Column
                  key={c.id}
                  id={c.id}
                  label={c.label}
                  tasks={items[c.id]}
                  visibleIds={visibleIds}
                  hiddenIds={hiddenIds}
                  onAdd={openModal}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          </div>
        }
      />

      <DragOverlay>
        {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
      </DragOverlay>

      {modalOpen && (
        <NewTaskModal
          defaultColumn={modalDefaultCol}
          cases={uniqueCases}
          onClose={() => setModalOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </DndContext>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// New Task Modal
// ──────────────────────────────────────────────────────────────────────────
function NewTaskModal({
  defaultColumn,
  cases,
  onClose,
  onCreate,
}: {
  defaultColumn: TaskColumn;
  cases: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (data: {
    title: string;
    caseId: string;
    caseName: string;
    dueDate: Date | null;
    priority: TaskPriority;
    column: TaskColumn;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [dueStr, setDueStr] = useState(format(new Date(), "yyyy-MM-dd"));
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [column, setColumn] = useState<TaskColumn>(defaultColumn);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const caseName =
      cases.find((c) => c.id === caseId)?.name ?? "General Directive";
    onCreate({
      title: title.trim(),
      caseId,
      caseName,
      dueDate: dueStr ? new Date(dueStr) : null,
      priority,
      column,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-lawdger-espresso/60 backdrop-blur-md">
      <div className="w-full max-w-lg bg-lawdger-cream rounded-3xl shadow-2xl shadow-lawdger-espresso/40 border border-lawdger-border/20 overflow-hidden">
        <div className="flex justify-between items-center px-6 py-5 border-b border-lawdger-border/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-lawdger-gold/15 text-lawdger-espresso flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <ContentHeading className="text-lawdger-espresso text-[1.25rem]">
                New Task
              </ContentHeading>
              <p className="text-[10px] uppercase tracking-widest font-bold text-lawdger-muted mt-0.5">
                Delegate a directive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-lawdger-espresso/5 text-lawdger-muted hover:text-lawdger-espresso transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
              Title
            </label>
            <input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Draft rejoinder to written statement"
              className="w-full bg-white border border-lawdger-border/20 rounded-xl px-4 py-3 text-[14px] text-lawdger-espresso focus:outline-none focus:border-lawdger-gold/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
                Case
              </label>
              <select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                className="w-full bg-white border border-lawdger-border/20 rounded-xl px-3 py-3 text-[13px] text-lawdger-espresso focus:outline-none focus:border-lawdger-gold/50"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={dueStr}
                onChange={(e) => setDueStr(e.target.value)}
                className="w-full bg-white border border-lawdger-border/20 rounded-xl px-3 py-3 text-[13px] text-lawdger-espresso focus:outline-none focus:border-lawdger-gold/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as TaskPriority)
                }
                className="w-full bg-white border border-lawdger-border/20 rounded-xl px-3 py-3 text-[13px] text-lawdger-espresso focus:outline-none focus:border-lawdger-gold/50"
              >
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
                Assignee Column
              </label>
              <select
                value={column}
                onChange={(e) =>
                  setColumn(e.target.value as TaskColumn)
                }
                className="w-full bg-white border border-lawdger-border/20 rounded-xl px-3 py-3 text-[13px] text-lawdger-espresso focus:outline-none focus:border-lawdger-gold/50"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-lawdger-espresso text-lawdger-cream font-bold py-3.5 rounded-xl uppercase tracking-widest text-[12px] hover:bg-lawdger-sidebar transition-colors"
          >
            Create Task
          </button>
        </form>
      </div>
    </div>
  );
}
