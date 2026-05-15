"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Briefcase,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  FileText,
  Inbox,
  Plus,
  Search,
  Trash2,
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
type TaskColumn = "unassigned" | "my-plate" | "associates" | "clerks";

type Task = {
  id: string;
  title: string;
  caseName: string;
  caseId: string;
  dueDate: Date | null;
  priority: TaskPriority;
  column: TaskColumn;
  notes: string;
  completed: boolean;
};

type ItemsState = Record<TaskColumn, Task[]>;

const KANBAN_COLUMNS: { id: Exclude<TaskColumn, "unassigned">; label: string }[] = [
  { id: "my-plate", label: "My Plate" },
  { id: "associates", label: "Associates" },
  { id: "clerks", label: "Clerks & Filings" },
];

const COLUMN_ICON: Record<TaskColumn, React.ElementType> = {
  unassigned: Inbox,
  "my-plate": Briefcase,
  associates: Users,
  clerks: FileText,
};

const COLUMN_LABEL: Record<TaskColumn, string> = {
  unassigned: "Unassigned",
  "my-plate": "My Plate",
  associates: "Associates",
  clerks: "Clerks & Filings",
};

// ──────────────────────────────────────────────────────────────────────────
// Mock seed data
// ──────────────────────────────────────────────────────────────────────────
const today = new Date();
const days = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};

const SEED: ItemsState = {
  unassigned: [
    {
      id: "u1",
      title: "Voice: follow up with client re: settlement offer Mehta vs MCD",
      caseName: "",
      caseId: "",
      dueDate: null,
      priority: "normal",
      column: "unassigned",
      notes: "",
      completed: false,
    },
    {
      id: "u2",
      title: "Capture: order copy received — verify clerical errors",
      caseName: "",
      caseId: "",
      dueDate: null,
      priority: "normal",
      column: "unassigned",
      notes: "",
      completed: false,
    },
    {
      id: "u3",
      title: "Call: senior counsel availability for Friday hearing",
      caseName: "",
      caseId: "",
      dueDate: null,
      priority: "urgent",
      column: "unassigned",
      notes: "",
      completed: false,
    },
  ],
  "my-plate": [
    {
      id: "t1",
      title: "Draft counter-affidavit — Reliance vs Future Retail",
      caseName: "Reliance vs Future Retail",
      caseId: "c-reliance",
      dueDate: days(-2),
      priority: "urgent",
      column: "my-plate",
      notes: "",
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
      notes: "",
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
      notes: "",
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
      notes: "",
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
      notes: "",
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
      notes: "",
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
      notes: "",
      completed: false,
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────
const ALL_COLUMNS: TaskColumn[] = ["unassigned", "my-plate", "associates", "clerks"];

function findColumnOf(items: ItemsState, id: string): TaskColumn | null {
  if (ALL_COLUMNS.includes(id as TaskColumn)) return id as TaskColumn;
  for (const col of ALL_COLUMNS) {
    if (items[col].some((t) => t.id === id)) return col;
  }
  return null;
}

function findTask(items: ItemsState, id: string): Task | null {
  for (const col of ALL_COLUMNS) {
    const t = items[col].find((x) => x.id === id);
    if (t) return t;
  }
  return null;
}

function dueLabel(d: Date | null): string {
  if (!d) return "No date";
  if (isToday(d)) return "Today";
  if (isPast(d)) return "Overdue";
  const diff = differenceInCalendarDays(d, new Date());
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return `In ${diff}d`;
  return format(d, "MMM d");
}

function dueClasses(d: Date | null): string {
  if (!d) return "text-lawdger-muted";
  if (isToday(d)) return "text-lawdger-gold";
  if (isPast(d)) return "text-destructive";
  const diff = differenceInCalendarDays(d, new Date());
  if (diff === 1) return "text-lawdger-gold";
  return "text-lawdger-muted";
}

function priorityBorderClass(p: TaskPriority): string {
  if (p === "urgent") return "border-l-destructive";
  if (p === "normal") return "border-l-lawdger-gold";
  return "border-l-lawdger-muted";
}

// ──────────────────────────────────────────────────────────────────────────
// Assigned Task Card (cream pane) — white surface, 3px left priority border
// NOTE: bg-white is the single justified raw-color exception in this codebase.
// Cards on the cream pane need to read as elevated against bg-lawdger-cream;
// "white" is a CSS keyword (not a raw hex), used here only for that contrast.
// ──────────────────────────────────────────────────────────────────────────
function AssignedCard({
  task,
  hidden,
  onClick,
}: {
  task: Task;
  hidden: boolean;
  onClick: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

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
        "group bg-white rounded-xl shadow-sm",
        "border border-lawdger-border/15 border-l-[3px]",
        priorityBorderClass(task.priority),
        "p-4 cursor-pointer",
        "hover:shadow-md hover:-translate-y-px hover:border-lawdger-border/30",
        "transition-all duration-150",
      ].join(" ")}
    >
      {/* Fix 2: espresso ink, text-sm */}
      <div className="text-sm font-medium text-lawdger-espresso leading-snug line-clamp-2">
        {task.title}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center bg-lawdger-espresso/8 text-lawdger-espresso/70 text-xs font-medium px-2 py-0.5 rounded-full max-w-[65%] truncate">
          {task.caseName || "No case"}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${dueClasses(
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

function AssignedCardOverlay({ task }: { task: Task }) {
  return (
    <div
      className={[
        "rotate-2 bg-white rounded-xl shadow-xl shadow-lawdger-espresso/30",
        "border border-lawdger-border/20 border-l-[3px]",
        priorityBorderClass(task.priority),
        "p-4 w-full",
      ].join(" ")}
    >
      <div className="text-sm font-medium text-lawdger-espresso leading-snug line-clamp-2">
        {task.title}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center bg-lawdger-espresso/8 text-lawdger-espresso/70 text-xs font-medium px-2 py-0.5 rounded-full max-w-[65%] truncate">
          {task.caseName || "No case"}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${dueClasses(
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
// Unassigned Task Card (dark pane) — cream-on-espresso compact
// ──────────────────────────────────────────────────────────────────────────
function UnassignedCard({
  task,
  hidden,
  onClick,
}: {
  task: Task;
  hidden: boolean;
  onClick: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

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
        "bg-lawdger-cream/8 border border-lawdger-cream/12 rounded-xl p-3",
        "cursor-pointer hover:border-lawdger-gold/40 hover:bg-lawdger-cream/15",
        "transition-colors duration-150",
      ].join(" ")}
    >
      {/* Unassigned card: cream-on-espresso, 90% legibility */}
      <div className="text-sm font-medium text-lawdger-cream/90 leading-snug line-clamp-2">
        {task.title}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="inline-flex items-center bg-lawdger-cream/10 border border-lawdger-cream/15 text-lawdger-cream/50 text-xs font-medium px-2 py-0.5 rounded-full">
          {task.caseName || "Untriaged"}
        </span>
        {task.priority === "urgent" && (
          <span className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_6px_rgba(220,38,38,0.7)]" />
        )}
      </div>
    </div>
  );
}

function UnassignedCardOverlay({ task }: { task: Task }) {
  return (
    <div className="rotate-2 bg-lawdger-cream/15 border border-lawdger-gold/40 rounded-xl p-3 shadow-xl shadow-lawdger-espresso/40 w-full">
      <div className="font-sans text-[12.5px] font-medium text-lawdger-cream leading-snug line-clamp-2 tracking-normal">
        {task.title}
      </div>
      <div className="mt-2">
        <span className="inline-flex items-center bg-lawdger-cream/10 text-lawdger-cream/70 text-[10px] font-semibold px-2 py-0.5 rounded-full">
          {task.caseName || "Untriaged"}
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Kanban Column (cream pane)
// ──────────────────────────────────────────────────────────────────────────
function KanbanColumn({
  id,
  label,
  tasks,
  visibleIds,
  hiddenIds,
  onAdd,
  onCardClick,
  isLast = false,
}: {
  id: Exclude<TaskColumn, "unassigned">;
  label: string;
  tasks: Task[];
  visibleIds: Set<string>;
  hiddenIds: Set<string>;
  onAdd: (col: TaskColumn) => void;
  onCardClick: (id: string) => void;
  isLast?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const Icon = COLUMN_ICON[id];
  const visibleCount = tasks.filter((t) => visibleIds.has(t.id)).length;

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex flex-col h-full min-h-0 rounded-2xl p-3 transition-colors",
        // Fix 3: right border as column divider (except last column)
        !isLast ? "border-r border-lawdger-border/15" : "",
        // Fix 5: three depth layers — cream pane → column zone → card
        isOver
          ? "bg-lawdger-base/60 ring-1 ring-lawdger-gold/40"
          : "bg-lawdger-base/40",
      ].join(" ")}
    >
      {/* Fix 1: Header — serif heading, sentence case, stronger separator */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-lawdger-border/20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-3.5 h-3.5 text-lawdger-espresso/50 shrink-0" />
          <h3 className="font-serif text-lg lg:text-xl text-lawdger-espresso whitespace-nowrap truncate leading-tight">
            {label}
          </h3>
          <span className="text-xs font-sans font-medium text-lawdger-muted bg-lawdger-espresso/8 px-2 py-0.5 rounded-full shrink-0">
            {visibleCount}
          </span>
        </div>
        <button
          onClick={() => onAdd(id)}
          aria-label={`Add task to ${label}`}
          className="w-6 h-6 rounded-md text-lawdger-muted opacity-0 group-hover:opacity-100 hover:bg-lawdger-espresso/5 hover:text-lawdger-espresso flex items-center justify-center transition-opacity"
          tabIndex={-1}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-2 pr-1">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((t) => (
            <AssignedCard
              key={t.id}
              task={t}
              hidden={hiddenIds.has(t.id)}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {visibleCount === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[100px] rounded-xl border border-dashed border-lawdger-border/25 text-center px-4 py-6">
            <p className="text-[10.5px] font-semibold uppercase tracking-widest text-lawdger-muted">
              Drop tasks here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Unassigned drop zone (dark pane) — contains quick-add + sortable list
// ──────────────────────────────────────────────────────────────────────────
function UnassignedZone({
  tasks,
  visibleIds,
  hiddenIds,
  onCardClick,
  onQuickAdd,
}: {
  tasks: Task[];
  visibleIds: Set<string>;
  hiddenIds: Set<string>;
  onCardClick: (id: string) => void;
  onQuickAdd: (title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });
  const visibleCount = tasks.filter((t) => visibleIds.has(t.id)).length;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    onQuickAdd(v);
    setDraft("");
    setAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex flex-col min-h-0 flex-1 rounded-2xl transition-colors",
        isOver
          ? "bg-lawdger-cream/8 ring-1 ring-lawdger-gold/40"
          : "bg-transparent",
      ].join(" ")}
    >
      {/* Section header */}
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lawdger-cream/50">
            Unassigned
          </p>
          <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] rounded-full bg-lawdger-cream/10 text-lawdger-cream/80 text-[10px] font-bold px-1.5">
            {visibleCount}
          </span>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/60 hover:text-lawdger-gold transition-colors"
        >
          <Plus className="w-3 h-3" />
          Quick Add
        </button>
      </div>

      {/* Inline quick-add */}
      {adding && (
        <div className="mb-2 shrink-0 flex items-center gap-2 bg-lawdger-cream/8 border border-lawdger-cream/15 rounded-xl px-3 py-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder="Capture a task…"
            className="flex-1 bg-transparent text-[12.5px] text-lawdger-cream placeholder:text-lawdger-cream/30 focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            aria-label="Add task"
            className="w-6 h-6 rounded-md bg-lawdger-gold/20 hover:bg-lawdger-gold/30 disabled:opacity-30 text-lawdger-gold flex items-center justify-center transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-2 pr-1">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((t) => (
            <UnassignedCard
              key={t.id}
              task={t}
              hidden={hiddenIds.has(t.id)}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {visibleCount === 0 && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <CheckCircle2 className="w-4 h-4 text-lawdger-cream/30" />
            <p className="text-[10.5px] font-semibold text-lawdger-cream/40 text-center">
              All caught up — no unassigned tasks
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
  const [search, setSearch] = useState("");

  // modal state
  const [modalMode, setModalMode] = useState<"closed" | "create" | "edit">(
    "closed"
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createDefaultColumn, setCreateDefaultColumn] =
    useState<TaskColumn>("my-plate");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ── derived ─────────────────────────────────────────────────────────────
  const allTasks = useMemo(
    () => ALL_COLUMNS.flatMap((k) => items[k]),
    [items]
  );

  const kanbanTasks = useMemo(
    () => [...items["my-plate"], ...items.associates, ...items.clerks],
    [items]
  );

  const stats = useMemo(() => {
    const tracked = kanbanTasks; // exclude unassigned from "pending"
    const pending = tracked.filter((t) => !t.completed);
    const todayList = pending.filter((t) => t.dueDate && isToday(t.dueDate));
    const overdue = pending.filter(
      (t) => t.dueDate && isPast(t.dueDate) && !isToday(t.dueDate)
    );
    const weekStart = startOfWeek(new Date());
    const doneThisWeek = allTasks.filter(
      (t) => t.completed && t.dueDate && t.dueDate >= weekStart
    );
    return {
      pending: pending.length,
      today: todayList.length,
      overdue: overdue.length,
      doneThisWeek: doneThisWeek.length,
    };
  }, [kanbanTasks, allTasks]);

  const uniqueCases = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of allTasks) {
      if (t.caseId) seen.set(t.caseId, t.caseName);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [allTasks]);

  // ── search filter ───────────────────────────────────────────────────────
  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    const s = new Set<string>();
    for (const t of allTasks) {
      if (!q || `${t.title} ${t.caseName}`.toLowerCase().includes(q)) {
        s.add(t.id);
      }
    }
    return s;
  }, [allTasks, search]);

  const hiddenIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of allTasks) if (!visibleIds.has(t.id)) s.add(t.id);
    return s;
  }, [allTasks, visibleIds]);

  // ── dnd handlers ────────────────────────────────────────────────────────
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

  // ── task ops ────────────────────────────────────────────────────────────
  const handleQuickAdd = (title: string) => {
    const newTask: Task = {
      id: `t-${Date.now()}`,
      title,
      caseName: "",
      caseId: "",
      dueDate: null,
      priority: "normal",
      column: "unassigned",
      notes: "",
      completed: false,
    };
    setItems((prev) => ({
      ...prev,
      unassigned: [newTask, ...prev.unassigned],
    }));
  };

  const openCreate = (col: TaskColumn = "my-plate") => {
    setCreateDefaultColumn(col);
    setEditingId(null);
    setModalMode("create");
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode("closed");
    setEditingId(null);
  };

  const handleSave = (data: {
    id: string | null;
    title: string;
    caseId: string;
    caseName: string;
    dueDate: Date | null;
    priority: TaskPriority;
    column: TaskColumn;
    notes: string;
  }) => {
    if (data.id) {
      const editId: string = data.id;
      // edit: find + update; if column changed, move between buckets
      setItems((prev) => {
        const next: ItemsState = {
          unassigned: [...prev.unassigned],
          "my-plate": [...prev["my-plate"]],
          associates: [...prev.associates],
          clerks: [...prev.clerks],
        };
        let currentCol: TaskColumn | null = null;
        for (const col of ALL_COLUMNS) {
          if (next[col].some((t) => t.id === editId)) {
            currentCol = col;
            break;
          }
        }
        if (!currentCol) return prev;

        const updated: Task = {
          id: editId,
          title: data.title,
          caseName: data.caseName,
          caseId: data.caseId,
          dueDate: data.dueDate,
          priority: data.priority,
          column: data.column,
          notes: data.notes,
          completed:
            next[currentCol].find((t) => t.id === editId)?.completed ?? false,
        };

        if (currentCol === data.column) {
          next[currentCol] = next[currentCol].map((t) =>
            t.id === editId ? updated : t
          );
        } else {
          next[currentCol] = next[currentCol].filter((t) => t.id !== editId);
          next[data.column] = [updated, ...next[data.column]];
        }
        return next;
      });
    } else {
      // create
      const newTask: Task = {
        id: `t-${Date.now()}`,
        title: data.title,
        caseName: data.caseName,
        caseId: data.caseId,
        dueDate: data.dueDate,
        priority: data.priority,
        column: data.column,
        notes: data.notes,
        completed: false,
      };
      setItems((prev) => ({
        ...prev,
        [data.column]: [newTask, ...prev[data.column]],
      }));
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    setItems((prev) => {
      const next: ItemsState = {
        unassigned: prev.unassigned.filter((t) => t.id !== id),
        "my-plate": prev["my-plate"].filter((t) => t.id !== id),
        associates: prev.associates.filter((t) => t.id !== id),
        clerks: prev.clerks.filter((t) => t.id !== id),
      };
      return next;
    });
    closeModal();
  };

  const activeTask = activeId ? findTask(items, activeId) : null;
  const editingTask = editingId ? findTask(items, editingId) : null;

  // ──────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────
  return (
    <DndContext
      id="tasks-kanban"
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
            onClick={() => openCreate("my-plate")}
            className="flex items-center gap-2 bg-lawdger-espresso text-lawdger-cream px-5 py-2.5 rounded-full text-[11px] font-bold tracking-widest uppercase shadow-md hover:bg-lawdger-sidebar transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-lawdger-gold" />
            New Task
          </button>
        }
        darkPaneHeader={
          <DarkPaneHeaderTitle
            icon={Activity}
            title="Orchestration"
            subtitle="Capture & Triage"
          />
        }
        darkPaneContent={
          <div className="flex flex-col gap-5 h-full min-h-0">
            {/* Compact 2x2 stat grid */}
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <StatTile label="Total" value={stats.pending} />
              <StatTile label="Due Today" value={stats.today} accent="gold" />
              <StatTile
                label="Overdue"
                value={stats.overdue}
                accent={stats.overdue > 0 ? "red" : undefined}
              />
              <StatTile label="Done / Wk" value={stats.doneThisWeek} />
            </div>

            {/* Quick search */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-lawdger-cream/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="w-full bg-lawdger-cream/8 border border-lawdger-cream/12 rounded-xl pl-9 pr-3 py-2.5 text-[12.5px] text-lawdger-cream placeholder:text-lawdger-cream/30 focus:outline-none focus:border-lawdger-gold/40 transition-colors"
              />
            </div>

            {/* Unassigned section */}
            <UnassignedZone
              tasks={items.unassigned}
              visibleIds={visibleIds}
              hiddenIds={hiddenIds}
              onCardClick={openEdit}
              onQuickAdd={handleQuickAdd}
            />
          </div>
        }
        mainPaneHeader={
          <>
            {/* Fix 4: direct h3 — ContentHeading's dark:text-white would override className,
                so we render the heading directly to guarantee text-lawdger-espresso always wins
                (proven by column h3s: @layer base color < utility class specificity) */}
            <h3 className="font-serif text-2xl text-lawdger-espresso leading-tight tracking-tight">
              Active Assignments
            </h3>
            <span className="text-xs font-sans font-medium text-lawdger-muted bg-lawdger-espresso/8 px-2.5 py-1 rounded-full">
              {kanbanTasks.length} tracked
            </span>
          </>
        }
        mainPaneContent={
          // Phase 3h: no inner wrapper, no negative margin. The cream pane's
          // inner padding (pl-2 lg:pl-3 from LayoutShell) places the first
          // column ~8–12px from the pane's left edge — deep inside the
          // glassmorphism strip, visible against the espresso bleed-through.
          // Each KanbanColumn owns its own h-full overflow-y-auto list, so
          // the grid itself does not scroll — columns scroll individually.
          <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-3 px-2 lg:px-3 pb-2 min-h-0">
            {KANBAN_COLUMNS.map((c, idx) => (
              <KanbanColumn
                key={c.id}
                id={c.id}
                label={c.label}
                tasks={items[c.id]}
                visibleIds={visibleIds}
                hiddenIds={hiddenIds}
                onAdd={openCreate}
                onCardClick={openEdit}
                isLast={idx === KANBAN_COLUMNS.length - 1}
              />
            ))}
          </div>
        }
      />

      <DragOverlay>
        {activeTask ? (
          activeTask.column === "unassigned" ? (
            <UnassignedCardOverlay task={activeTask} />
          ) : (
            <AssignedCardOverlay task={activeTask} />
          )
        ) : null}
      </DragOverlay>

      {modalMode !== "closed" && (
        <TaskDetailModal
          mode={modalMode}
          task={editingTask}
          defaultColumn={createDefaultColumn}
          cases={uniqueCases}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </DndContext>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Stat Tile
// ──────────────────────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "gold" | "red";
}) {
  const valueColor =
    accent === "gold"
      ? "text-lawdger-gold"
      : accent === "red"
      ? "text-destructive"
      : "text-lawdger-cream";
  return (
    <div className="bg-lawdger-cream/8 border border-lawdger-cream/12 rounded-xl px-3 py-2.5 h-[78px] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-lawdger-cream/50">
          {label}
        </p>
        {accent === "red" && (
          <span className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_6px_rgba(220,38,38,0.7)]" />
        )}
      </div>
      <p className={`text-[1.6rem] font-bold leading-none ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Task Detail Modal — create + edit modes
// ──────────────────────────────────────────────────────────────────────────
function TaskDetailModal({
  mode,
  task,
  defaultColumn,
  cases,
  onClose,
  onSave,
  onDelete,
}: {
  mode: "create" | "edit";
  task: Task | null;
  defaultColumn: TaskColumn;
  cases: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: {
    id: string | null;
    title: string;
    caseId: string;
    caseName: string;
    dueDate: Date | null;
    priority: TaskPriority;
    column: TaskColumn;
    notes: string;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [caseId, setCaseId] = useState(task?.caseId ?? cases[0]?.id ?? "");
  const [dueStr, setDueStr] = useState(
    task?.dueDate ? format(task.dueDate, "yyyy-MM-dd") : ""
  );
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "normal"
  );
  const [column, setColumn] = useState<TaskColumn>(
    task?.column ?? defaultColumn
  );
  const [notes, setNotes] = useState(task?.notes ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const caseName =
      cases.find((c) => c.id === caseId)?.name ??
      task?.caseName ??
      "";
    onSave({
      id: task?.id ?? null,
      title: title.trim(),
      caseId,
      caseName,
      dueDate: dueStr ? new Date(dueStr) : null,
      priority,
      column,
      notes,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-lawdger-espresso/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-lawdger-cream rounded-2xl shadow-2xl border border-lawdger-border/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header w/ priority left border accent */}
        <div
          className={[
            "flex justify-between items-start px-6 py-5 border-l-[3px]",
            priorityBorderClass(priority),
            "border-b border-lawdger-border/10",
          ].join(" ")}
        >
          <div className="flex-1 pr-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
              {mode === "create" ? "New Task" : "Edit Task"}
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title…"
              className="w-full bg-transparent text-[18px] font-semibold text-lawdger-espresso placeholder:text-lawdger-muted focus:outline-none"
              autoFocus
            />
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-lawdger-espresso/5 text-lawdger-muted hover:text-lawdger-espresso transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {/* Case */}
          <Field label="Case">
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full bg-white border border-lawdger-border/20 rounded-lg px-3 py-2.5 text-[13px] text-lawdger-espresso focus:outline-none focus:border-lawdger-gold/50"
            >
              <option value="">— No case —</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          {/* Due date */}
          <Field label="Due Date">
            <input
              type="date"
              value={dueStr}
              onChange={(e) => setDueStr(e.target.value)}
              className="w-full bg-white border border-lawdger-border/20 rounded-lg px-3 py-2.5 text-[13px] text-lawdger-espresso focus:outline-none focus:border-lawdger-gold/50"
            />
          </Field>

          {/* Priority segmented */}
          <Field label="Priority">
            <SegmentedControl
              value={priority}
              onChange={(v) => setPriority(v as TaskPriority)}
              options={[
                { value: "urgent", label: "Urgent" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low" },
              ]}
            />
          </Field>

          {/* Column segmented */}
          <Field label="Column / Assignee">
            <SegmentedControl
              value={column}
              onChange={(v) => setColumn(v as TaskColumn)}
              options={[
                { value: "unassigned", label: "Unassigned" },
                { value: "my-plate", label: "My Plate" },
                { value: "associates", label: "Associates" },
                { value: "clerks", label: "Clerks" },
              ]}
            />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context…"
              className="w-full bg-white border border-lawdger-border/20 rounded-lg px-3 py-2.5 text-[13px] text-lawdger-espresso placeholder:text-lawdger-muted focus:outline-none focus:border-lawdger-gold/50 min-h-[120px] resize-y"
            />
          </Field>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            {mode === "edit" && task ? (
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-destructive/70 hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={!title.trim()}
              className="bg-lawdger-espresso text-lawdger-cream px-6 py-2.5 rounded-lg text-[11px] font-bold tracking-widest uppercase hover:bg-lawdger-sidebar disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {mode === "create" ? "Create Task" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg bg-lawdger-base p-1 border border-lawdger-border/20 w-full">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            "flex-1 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition-colors",
            value === opt.value
              ? "bg-lawdger-espresso text-lawdger-cream"
              : "text-lawdger-espresso/60 hover:text-lawdger-espresso",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Silence unused-import warnings for icons we may use later
void COLUMN_LABEL;
