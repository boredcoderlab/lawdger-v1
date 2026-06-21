"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  Activity,
  AlertCircle,
  Briefcase,
  Calendar as CalendarIcon,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  differenceInCalendarDays,
  format,
  isPast,
  isToday,
} from "date-fns";
import {
  PageLayout,
  DarkPaneHeaderTitle,
  ContentHeading,
} from "@/components/ui/LayoutShell";
import {
  createCaseTask,
  toggleCaseTaskStatus,
  deleteCaseTask,
  updateCaseTask,
  type TaskRow,
  type UpdateCaseTaskInput,
} from "@/actions/taskActions";
import { bucketTask } from "@/lib/task-bucket";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────
type Buckets = {
  unassigned: TaskRow[];
  myPlate: TaskRow[];
  associates: TaskRow[];
};

type Stats = {
  total: number;
  dueToday: number;
  overdue: number;
  doneThisWeek: number;
};

type CaseOption = { id: string; title: string; caseNumber: string | null };

type AssignedColumnId = "my-plate" | "associates";

const COLUMN_LABEL: Record<AssignedColumnId, string> = {
  "my-plate": "My Plate",
  associates: "Associates",
};

const COLUMN_ICON: Record<AssignedColumnId, React.ElementType> = {
  "my-plate": Briefcase,
  associates: Users,
};

// ──────────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────
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

function caseChipLabel(c: { title: string; caseNumber: string | null }) {
  return c.caseNumber ? `${c.title} · ${c.caseNumber}` : c.title;
}

function istDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ──────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────
export default function TasksClient({
  buckets: initialBuckets,
  stats: initialStats,
  cases,
  userName,
  error: initialError,
}: {
  buckets: Buckets;
  stats: Stats;
  cases: CaseOption[];
  userName: string | null;
  error?: string;
}) {
  const [unassigned, setUnassigned] = useState<TaskRow[]>(initialBuckets.unassigned);
  const [myPlate, setMyPlate] = useState<TaskRow[]>(initialBuckets.myPlate);
  const [associates, setAssociates] = useState<TaskRow[]>(initialBuckets.associates);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [, startTransition] = useTransition();

  const allTasks = useMemo(
    () => [...unassigned, ...myPlate, ...associates],
    [unassigned, myPlate, associates],
  );

  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const s = new Set<string>();
    for (const t of allTasks) {
      const hay = `${t.description} ${t.case.title} ${t.case.caseNumber ?? ""}`.toLowerCase();
      if (hay.includes(q)) s.add(t.id);
    }
    return s;
  }, [allTasks, search]);

  const isVisible = (id: string) => visibleIds === null || visibleIds.has(id);

  const detailTask =
    detailTaskId ? allTasks.find((t) => t.id === detailTaskId) ?? null : null;

  // ── snapshot / rollback ─────────────────────────────────────────────────
  type Snapshot = { unassigned: TaskRow[]; myPlate: TaskRow[]; associates: TaskRow[]; stats: Stats };
  function snapshot(): Snapshot {
    return {
      unassigned: structuredClone(unassigned),
      myPlate: structuredClone(myPlate),
      associates: structuredClone(associates),
      stats: { ...stats },
    };
  }
  function rollback(snap: Snapshot) {
    setUnassigned(snap.unassigned);
    setMyPlate(snap.myPlate);
    setAssociates(snap.associates);
    setStats(snap.stats);
  }

  function deriveStats(u: TaskRow[], mp: TaskRow[], as: TaskRow[]): Stats {
    const all = [...u, ...mp, ...as];
    const now = new Date();
    const todayKey = istDateKey(now);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const tracked = [...mp, ...as];
    return {
      total: tracked.filter((t) => t.status !== "completed").length,
      dueToday: all.filter(
        (t) => t.dueDate !== null && istDateKey(t.dueDate) === todayKey,
      ).length,
      overdue: all.filter(
        (t) =>
          t.dueDate !== null &&
          t.dueDate.getTime() < now.getTime() &&
          istDateKey(t.dueDate) !== todayKey &&
          t.status !== "completed",
      ).length,
      doneThisWeek: all.filter(
        (t) => t.status === "completed" && t.updatedAt.getTime() >= weekAgo.getTime(),
      ).length,
    };
  }

  // ── mutations (optimistic + rollback) ───────────────────────────────────
  async function handleToggle(task: TaskRow) {
    const snap = snapshot();
    const newStatus = task.status === "pending" ? "completed" : "pending";
    const updated: TaskRow = { ...task, status: newStatus, updatedAt: new Date() };
    const replace = (arr: TaskRow[]) => arr.map((t) => (t.id === task.id ? updated : t));
    const nextUnassigned = replace(unassigned);
    const nextMyPlate = replace(myPlate);
    const nextAssociates = replace(associates);
    setUnassigned(nextUnassigned);
    setMyPlate(nextMyPlate);
    setAssociates(nextAssociates);
    setStats(deriveStats(nextUnassigned, nextMyPlate, nextAssociates));
    startTransition(async () => {
      const result = await toggleCaseTaskStatus(task.id, task.status, task.caseId);
      if (!result.ok) {
        rollback(snap);
        setErrorMsg(result.error);
      } else {
        setErrorMsg(null);
      }
    });
  }

  async function handleDelete(task: TaskRow) {
    const snap = snapshot();
    const filter = (arr: TaskRow[]) => arr.filter((t) => t.id !== task.id);
    const nextUnassigned = filter(unassigned);
    const nextMyPlate = filter(myPlate);
    const nextAssociates = filter(associates);
    setUnassigned(nextUnassigned);
    setMyPlate(nextMyPlate);
    setAssociates(nextAssociates);
    setDetailTaskId(null);
    setStats(deriveStats(nextUnassigned, nextMyPlate, nextAssociates));
    startTransition(async () => {
      const result = await deleteCaseTask(task.id, task.caseId);
      if (!result.ok) {
        rollback(snap);
        setErrorMsg(result.error);
      } else {
        setErrorMsg(null);
      }
    });
  }

  async function handleCreate(input: {
    caseId: string;
    description: string;
    dueDate?: Date;
    isUrgent: boolean;
  }) {
    const snap = snapshot();
    const caseInfo = cases.find((c) => c.id === input.caseId);
    if (!caseInfo) {
      setErrorMsg("Case not found");
      return;
    }
    const tempId = `optimistic-${Date.now()}`;
    const optimistic: TaskRow = {
      id: tempId,
      description: input.description,
      status: "pending",
      dueDate: input.dueDate ?? null,
      assignee: "Unassigned",
      isUrgent: input.isUrgent,
      createdAt: new Date(),
      updatedAt: new Date(),
      caseId: input.caseId,
      case: {
        id: caseInfo.id,
        title: caseInfo.title,
        caseNumber: caseInfo.caseNumber,
      },
    };
    const target = bucketTask({ assignee: optimistic.assignee }, userName);
    const nextUnassigned = target === "unassigned" ? [optimistic, ...unassigned] : unassigned;
    const nextMyPlate = target === "my-plate" ? [optimistic, ...myPlate] : myPlate;
    const nextAssociates = target === "associates" ? [optimistic, ...associates] : associates;
    setUnassigned(nextUnassigned);
    setMyPlate(nextMyPlate);
    setAssociates(nextAssociates);
    setStats(deriveStats(nextUnassigned, nextMyPlate, nextAssociates));
    setCreateOpen(false);

    startTransition(async () => {
      const result = await createCaseTask({
        caseId: input.caseId,
        description: input.description,
        dueDate: input.dueDate,
        isUrgent: input.isUrgent,
      });
      if (!result.ok) {
        rollback(snap);
        setErrorMsg(result.error);
      } else {
        setErrorMsg(null);
        const realId = result.data.id;
        const swap = (arr: TaskRow[]) =>
          arr.map((t) => (t.id === tempId ? { ...t, id: realId } : t));
        setUnassigned(swap);
        setMyPlate(swap);
        setAssociates(swap);
      }
    });
  }

  async function handleEdit(task: TaskRow, input: UpdateCaseTaskInput) {
    const snap = snapshot();
    const updated: TaskRow = {
      ...task,
      description: input.description,
      assignee: input.assignee,
      dueDate: input.dueDate,
      isUrgent: input.isUrgent,
      updatedAt: new Date(),
    };

    const removeTask = (arr: TaskRow[]) => arr.filter((t) => t.id !== task.id);
    const nextUnassigned = removeTask(unassigned);
    const nextMyPlate = removeTask(myPlate);
    const nextAssociates = removeTask(associates);

    const newBucket = bucketTask({ assignee: input.assignee }, userName);
    if (newBucket === "unassigned") nextUnassigned.unshift(updated);
    else if (newBucket === "my-plate") nextMyPlate.unshift(updated);
    else nextAssociates.unshift(updated);

    setUnassigned(nextUnassigned);
    setMyPlate(nextMyPlate);
    setAssociates(nextAssociates);
    setStats(deriveStats(nextUnassigned, nextMyPlate, nextAssociates));
    setEditingTask(null);

    startTransition(async () => {
      const result = await updateCaseTask(input);
      if (!result.ok) {
        rollback(snap);
        setErrorMsg("Couldn't save changes. Try again.");
        setTimeout(() => setErrorMsg(null), 5000);
      } else {
        setErrorMsg(null);
      }
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <PageLayout
        pageTitle="Tasks"
        headerAction={
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-gold px-5 py-2.5 text-[11px] tracking-widest uppercase shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
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
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <StatTile label="Total" value={stats.total} />
              <StatTile label="Due Today" value={stats.dueToday} accent="gold" />
              <StatTile
                label="Overdue"
                value={stats.overdue}
                accent={stats.overdue > 0 ? "red" : undefined}
              />
              <StatTile label="Done / Wk" value={stats.doneThisWeek} />
            </div>

            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-lawdger-cream/40 dark:text-foreground/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="w-full bg-lawdger-cream/8 dark:bg-white/8 border border-lawdger-cream/12 dark:border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-[12.5px] text-lawdger-cream dark:text-foreground placeholder:text-lawdger-cream/30 dark:placeholder:text-foreground/40 focus:outline-none focus:border-lawdger-gold/40 transition-colors"
              />
            </div>

            <UnassignedZone
              tasks={unassigned}
              isVisible={isVisible}
              onCardClick={setDetailTaskId}
              onQuickAdd={() => setCreateOpen(true)}
            />
          </div>
        }
        mainPaneHeader={
          <>
            <ContentHeading>Active Assignments</ContentHeading>
            <span className="chip chip-neutral text-xs font-sans font-medium shrink-0">
              {myPlate.length + associates.length} tracked
            </span>
          </>
        }
        mainPaneContent={
          <div className="h-full flex flex-col min-h-0">
            {errorMsg && (
              <div
                role="alert"
                className="mb-3 mx-2 lg:mx-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[12.5px] text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="flex-1">{errorMsg}</p>
                <button
                  onClick={() => setErrorMsg(null)}
                  aria-label="Dismiss error"
                  className="p-1 rounded-full hover:bg-destructive/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-3 px-2 lg:px-3 pb-2 min-h-0">
              <KanbanColumn
                id="my-plate"
                tasks={myPlate}
                userName={userName}
                isVisible={isVisible}
                onCardClick={setDetailTaskId}
                onToggle={handleToggle}
                onDelete={handleDelete}
                isLast={false}
              />
              <KanbanColumn
                id="associates"
                tasks={associates}
                userName={userName}
                isVisible={isVisible}
                onCardClick={setDetailTaskId}
                onToggle={handleToggle}
                onDelete={handleDelete}
                isLast={true}
              />
            </div>
          </div>
        }
      />

      {createOpen && (
        <CreateTaskDialog
          cases={cases}
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
        />
      )}

      {detailTask && (
        <TaskDetailDialog
          task={detailTask}
          onClose={() => setDetailTaskId(null)}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onEdit={(t) => {
            setDetailTaskId(null);
            setEditingTask(t);
          }}
        />
      )}

      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          userName={userName}
          onClose={() => setEditingTask(null)}
          onSubmit={(input) => handleEdit(editingTask, input)}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Kanban Column (cream pane, read-only render)
// ──────────────────────────────────────────────────────────────────────────
function KanbanColumn({
  id,
  tasks,
  userName,
  isVisible,
  onCardClick,
  onToggle,
  onDelete,
  isLast,
}: {
  id: AssignedColumnId;
  tasks: TaskRow[];
  userName: string | null;
  isVisible: (id: string) => boolean;
  onCardClick: (id: string) => void;
  onToggle: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
  isLast: boolean;
}) {
  const Icon = COLUMN_ICON[id];
  const label = COLUMN_LABEL[id];
  const visibleTasks = tasks.filter((t) => isVisible(t.id));
  const showMyPlateHint =
    id === "my-plate" && visibleTasks.length === 0 && (!userName || !userName.trim());

  return (
    <div
      className={[
        "flex flex-col h-full min-h-0 rounded-2xl p-3 transition-colors",
        !isLast ? "border-r border-lawdger-border/15 dark:border-lawdger-border" : "",
        "bg-lawdger-base/40",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-lawdger-border/20 dark:border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-3.5 h-3.5 text-lawdger-espresso/50 dark:text-foreground-secondary shrink-0" />
          <h3 className="font-serif font-bold text-lg lg:text-xl text-lawdger-espresso dark:text-foreground leading-tight tracking-tight">
            {label}
          </h3>
          <span className="chip chip-neutral text-xs font-sans font-medium shrink-0">
            {visibleTasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-2 pr-1">
        {visibleTasks.map((t) => (
          <AssignedCard
            key={t.id}
            task={t}
            onClick={onCardClick}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}

        {visibleTasks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[100px] rounded-xl border border-dashed border-lawdger-border/25 dark:border-lawdger-border text-center px-4 py-6">
            {showMyPlateHint ? (
              <p className="text-[12px] text-muted-foreground">
                Set your name in Settings to route tasks to your plate.
              </p>
            ) : (
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-lawdger-muted">
                No tasks here
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Assigned Task Card (cream pane)
// ──────────────────────────────────────────────────────────────────────────
function AssignedCard({
  task,
  onClick,
  onToggle,
  onDelete,
}: {
  task: TaskRow;
  onClick: (id: string) => void;
  onToggle: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
}) {
  const completed = task.status === "completed";
  return (
    <div
      onClick={() => onClick(task.id)}
      className={[
        "group relative bg-white dark:bg-[var(--surface-2)] surface-inner rounded-xl shadow-sm dark:shadow-[0_14px_32px_-18px_rgba(0,0,0,0.7)]",
        "border border-lawdger-border/15 dark:border-[var(--border)]",
        "p-4 cursor-pointer card-interactive",
        "hover:shadow-md hover:-translate-y-px hover:border-lawdger-border/30 dark:hover:bg-[var(--surface-3)] dark:hover:border-[var(--border-strong)]",
        "transition-all duration-150",
      ].join(" ")}
    >
      {task.isUrgent && <UrgentPill className="absolute right-3 top-3" />}
      <div className="flex items-start gap-3 pr-16">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task);
          }}
          aria-label={completed ? "Mark pending" : "Mark complete"}
          className={[
            "mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
            completed
              ? "bg-lawdger-gold border-lawdger-gold"
              : "border-lawdger-border/40 hover:border-lawdger-gold",
          ].join(" ")}
        >
          {completed && <CheckCircle2 className="h-3 w-3 text-lawdger-cream" />}
        </button>
        <div className="flex-1 min-w-0">
          <div
            className={[
              "text-sm font-medium leading-snug line-clamp-2",
              completed
                ? "text-lawdger-muted line-through"
                : "text-lawdger-espresso dark:text-foreground",
            ].join(" ")}
          >
            {task.description}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Link
              href={`/cases/${task.caseId}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center bg-lawdger-espresso/8 dark:bg-[var(--surface-inset)] text-lawdger-espresso/70 dark:text-foreground/70 text-xs font-medium px-2 py-0.5 rounded-full max-w-[60%] truncate"
            >
              {caseChipLabel(task.case)}
            </Link>
            {dueLabel(task.dueDate) === "Overdue" ? (
              <span className="chip chip-danger">Overdue</span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${dueClasses(task.dueDate)}`}
              >
                <CalendarIcon className="w-3 h-3" />
                {dueLabel(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(task);
        }}
        aria-label="Delete task"
        className="absolute right-3 bottom-3 p-1.5 rounded-md text-lawdger-muted/0 group-hover:text-lawdger-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Unassigned Zone (dark pane)
// ──────────────────────────────────────────────────────────────────────────
function UnassignedZone({
  tasks,
  isVisible,
  onCardClick,
  onQuickAdd,
}: {
  tasks: TaskRow[];
  isVisible: (id: string) => boolean;
  onCardClick: (id: string) => void;
  onQuickAdd: () => void;
}) {
  const visibleTasks = tasks.filter((t) => isVisible(t.id));
  return (
    <div className="flex flex-col min-h-0 flex-1 rounded-2xl">
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lawdger-cream/50 dark:text-muted-foreground">
            Unassigned
          </p>
          <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] rounded-full bg-lawdger-cream/10 dark:bg-[var(--surface-2)] text-lawdger-cream/80 dark:text-foreground text-[10px] font-bold px-1.5">
            {visibleTasks.length}
          </span>
        </div>
        <button
          onClick={onQuickAdd}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/60 dark:text-foreground-secondary hover:text-lawdger-gold dark:hover:text-[var(--gold-text)] transition-colors"
        >
          <Plus className="w-3 h-3" />
          Quick Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-2 pr-1">
        {visibleTasks.map((t) => (
          <UnassignedCard key={t.id} task={t} onClick={onCardClick} />
        ))}

        {visibleTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <CheckCircle2 className="w-4 h-4 text-lawdger-cream/30 dark:text-foreground/30" />
            <p className="text-[10.5px] font-semibold text-lawdger-cream/40 dark:text-foreground/40 text-center">
              All caught up — no unassigned tasks
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function UnassignedCard({
  task,
  onClick,
}: {
  task: TaskRow;
  onClick: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onClick(task.id)}
      className={[
        "relative bg-lawdger-cream/8 dark:bg-foreground/5 border border-lawdger-cream/12 dark:border-lawdger-border rounded-xl p-3",
        "cursor-pointer hover:border-lawdger-gold/40 hover:bg-lawdger-cream/15 dark:hover:bg-foreground/8",
        "transition-colors duration-150",
      ].join(" ")}
    >
      {task.isUrgent && <UrgentPill className="absolute right-2 top-2" />}
      <div className="text-sm font-medium text-lawdger-cream/90 dark:text-foreground leading-snug line-clamp-2 pr-16">
        {task.description}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="chip-on-dark is-meta">{caseChipLabel(task.case)}</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Urgent pill — gold accent, reused across cards + dialogs.
// ──────────────────────────────────────────────────────────────────────────
function UrgentPill({ className }: { className?: string }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full bg-lawdger-gold/15 dark:bg-[var(--surface-inset)] text-[9px] font-bold uppercase tracking-widest px-2 py-0.5",
        className ?? "",
      ].join(" ")}
      style={{ color: "var(--gold-text, var(--accent-gold))" }}
    >
      Urgent
    </span>
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
        : "text-lawdger-cream dark:text-foreground";
  return (
    <div className="bg-lawdger-cream/8 dark:bg-[var(--surface-2)] border border-lawdger-cream/12 dark:border-[var(--border)] rounded-xl px-3 py-2.5 h-[78px] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-lawdger-cream/50 dark:text-muted-foreground">
          {label}
        </p>
        {accent === "red" && (
          <span className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_6px_rgba(220,38,38,0.7)]" />
        )}
      </div>
      <p className={`text-[1.6rem] font-bold leading-none ${valueColor}`}>{value}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Create Task Dialog
// ──────────────────────────────────────────────────────────────────────────
function CreateTaskDialog({
  cases,
  onClose,
  onCreate,
}: {
  cases: CaseOption[];
  onClose: () => void;
  onCreate: (input: {
    caseId: string;
    description: string;
    dueDate?: Date;
    isUrgent: boolean;
  }) => void;
}) {
  const [caseId, setCaseId] = useState("");
  const [description, setDescription] = useState("");
  const [dueStr, setDueStr] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  const canSubmit = caseId !== "" && description.trim() !== "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onCreate({
      caseId,
      description: description.trim(),
      dueDate: dueStr ? new Date(dueStr) : undefined,
      isUrgent,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-lawdger-espresso/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-lawdger-cream dark:bg-[var(--surface-3)] rounded-2xl shadow-2xl border border-lawdger-border/20 dark:border-[var(--border-strong)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start px-6 py-5 border-b border-lawdger-border/10 dark:border-lawdger-border">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-1">
              New Task
            </p>
            <h2 className="font-serif text-[1.4rem] font-bold text-lawdger-espresso dark:text-foreground leading-none">
              Capture an action item
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-lawdger-espresso/5 text-lawdger-muted hover:text-lawdger-espresso dark:hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          <Field label="Case (required)">
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full bg-white dark:bg-[var(--surface-inset)] border border-lawdger-border/20 dark:border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-lawdger-espresso dark:text-foreground focus:outline-none focus:border-lawdger-gold/50"
              required
            >
              <option value="">— Select a case —</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {caseChipLabel(c)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Action item…"
              className="w-full bg-white dark:bg-[var(--surface-inset)] border border-lawdger-border/20 dark:border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-lawdger-espresso dark:text-foreground placeholder:text-lawdger-muted focus:outline-none focus:border-lawdger-gold/50"
              autoFocus
              required
            />
          </Field>

          <Field label="Due Date (optional)">
            <input
              type="date"
              value={dueStr}
              onChange={(e) => setDueStr(e.target.value)}
              className="w-full bg-white dark:bg-[var(--surface-inset)] border border-lawdger-border/20 dark:border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-lawdger-espresso dark:text-foreground focus:outline-none focus:border-lawdger-gold/50"
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="h-4 w-4 rounded border-lawdger-border/40 text-lawdger-gold focus:ring-lawdger-gold/30"
            />
            <span className="text-[12.5px] font-medium text-lawdger-espresso dark:text-foreground">
              Mark as urgent
            </span>
          </label>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-gold px-6 py-2.5 rounded-lg text-[11px] tracking-widest uppercase disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Task Detail Dialog
// ──────────────────────────────────────────────────────────────────────────
function TaskDetailDialog({
  task,
  onClose,
  onToggle,
  onDelete,
  onEdit,
}: {
  task: TaskRow;
  onClose: () => void;
  onToggle: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
  onEdit: (t: TaskRow) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-lawdger-espresso/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-lawdger-cream dark:bg-[var(--surface-3)] rounded-2xl shadow-2xl border border-lawdger-border/20 dark:border-[var(--border-strong)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start px-6 py-5 border-b border-lawdger-border/10 dark:border-lawdger-border">
          <div className="flex-1 pr-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
              Task
            </p>
            <h2 className="font-serif text-[1.2rem] font-bold text-lawdger-espresso dark:text-foreground leading-snug">
              {task.description}
            </h2>
            {task.isUrgent && <UrgentPill className="mt-2" />}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-lawdger-espresso/5 text-lawdger-muted hover:text-lawdger-espresso dark:hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-3 text-[13px]">
          <Row label="Case" value={caseChipLabel(task.case)} />
          <Row label="Status" value={task.status} />
          <Row label="Assignee" value={task.assignee} />
          <Row
            label="Due Date"
            value={task.dueDate ? format(task.dueDate, "d MMM yyyy") : "—"}
          />

          <div className="flex items-center justify-between pt-4 border-t border-lawdger-border/10">
            <button
              onClick={() => onDelete(task)}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-destructive/70 hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(task)}
                className="px-5 py-2 rounded-lg text-[11px] tracking-widest uppercase border border-lawdger-border/20 dark:border-[var(--border)] text-lawdger-muted hover:text-lawdger-espresso dark:hover:text-foreground hover:border-lawdger-border/40 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  onToggle(task);
                  onClose();
                }}
                className="btn-gold px-5 py-2 rounded-lg text-[11px] tracking-widest uppercase"
              >
                {task.status === "pending" ? "Mark Complete" : "Mark Pending"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Edit Task Dialog
// ──────────────────────────────────────────────────────────────────────────
function EditTaskDialog({
  task,
  userName,
  onClose,
  onSubmit,
}: {
  task: TaskRow;
  userName: string | null;
  onClose: () => void;
  onSubmit: (input: UpdateCaseTaskInput) => void;
}) {
  const normalizedUserName = (userName ?? "").trim();
  const normalizedAssignee = (task.assignee ?? "").trim().toLowerCase();
  const normalizedUserNameLower = normalizedUserName.toLowerCase();

  const initialMode: "unassigned" | "me" | "other" =
    !normalizedAssignee || normalizedAssignee === "unassigned"
      ? "unassigned"
      : normalizedUserName && normalizedAssignee === normalizedUserNameLower
        ? "me"
        : "other";

  const [description, setDescription] = useState(task.description);
  const [assigneeMode, setAssigneeMode] = useState<"unassigned" | "me" | "other">(initialMode);
  const [assigneeOther, setAssigneeOther] = useState(
    initialMode === "other" ? task.assignee : "",
  );
  const [dueStr, setDueStr] = useState(
    task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "",
  );
  const [isUrgent, setIsUrgent] = useState(task.isUrgent);

  const canSubmit =
    description.trim() !== "" &&
    (assigneeMode !== "other" || assigneeOther.trim() !== "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const assigneeValue =
      assigneeMode === "unassigned"
        ? "Unassigned"
        : assigneeMode === "me"
          ? normalizedUserName
          : assigneeOther.trim();
    onSubmit({
      taskId: task.id,
      description: description.trim(),
      assignee: assigneeValue,
      dueDate: dueStr ? new Date(dueStr) : null,
      isUrgent,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-lawdger-espresso/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-lawdger-cream dark:bg-[var(--surface-3)] rounded-2xl shadow-2xl border border-lawdger-border/20 dark:border-[var(--border-strong)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start px-6 py-5 border-b border-lawdger-border/10 dark:border-lawdger-border">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-1">
              Edit Task
            </p>
            <h2 className="font-serif text-[1.4rem] font-bold text-lawdger-espresso dark:text-foreground leading-none">
              Update action item
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-lawdger-espresso/5 text-lawdger-muted hover:text-lawdger-espresso dark:hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white dark:bg-[var(--surface-inset)] border border-lawdger-border/20 dark:border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-lawdger-espresso dark:text-foreground placeholder:text-lawdger-muted focus:outline-none focus:border-lawdger-gold/50 resize-none"
              required
            />
          </Field>

          <Field label="Assignee">
            <select
              value={assigneeMode}
              onChange={(e) =>
                setAssigneeMode(e.target.value as "unassigned" | "me" | "other")
              }
              className="w-full bg-white dark:bg-[var(--surface-inset)] border border-lawdger-border/20 dark:border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-lawdger-espresso dark:text-foreground focus:outline-none focus:border-lawdger-gold/50"
            >
              <option value="unassigned">Unassigned</option>
              {normalizedUserName && (
                <option value="me">Me ({normalizedUserName})</option>
              )}
              <option value="other">Someone else…</option>
            </select>
            {assigneeMode === "other" && (
              <input
                type="text"
                value={assigneeOther}
                onChange={(e) => setAssigneeOther(e.target.value)}
                placeholder="Name…"
                autoFocus
                className="mt-2 w-full bg-white dark:bg-[var(--surface-inset)] border border-lawdger-border/20 dark:border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-lawdger-espresso dark:text-foreground placeholder:text-lawdger-muted focus:outline-none focus:border-lawdger-gold/50"
              />
            )}
          </Field>

          <Field label="Due Date (optional)">
            <input
              type="date"
              value={dueStr}
              onChange={(e) => setDueStr(e.target.value)}
              className="w-full bg-white dark:bg-[var(--surface-inset)] border border-lawdger-border/20 dark:border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-lawdger-espresso dark:text-foreground focus:outline-none focus:border-lawdger-gold/50"
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="h-4 w-4 rounded border-lawdger-border/40 text-lawdger-gold focus:ring-lawdger-gold/30"
            />
            <span className="text-[12.5px] font-medium text-lawdger-espresso dark:text-foreground">
              Mark as urgent
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-[11px] tracking-widest uppercase text-lawdger-muted hover:text-lawdger-espresso dark:hover:text-foreground border border-lawdger-border/20 dark:border-[var(--border)] hover:border-lawdger-border/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-gold px-6 py-2.5 rounded-lg text-[11px] tracking-widest uppercase disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-lawdger-muted">
        {label}
      </p>
      <p className="text-[13px] font-medium text-lawdger-espresso dark:text-foreground truncate">
        {value}
      </p>
    </div>
  );
}
