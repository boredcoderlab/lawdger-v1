"use server";

/**
 * Mixed contract module.
 *
 * Functions added in phase 3.2 (createCaseTask, toggleCaseTaskStatus,
 * deleteCaseTask) follow the 3.2 contract: Zod input, RLS-scoped Prisma
 * via getServerScopedPrisma, defence-in-depth `where: { userId }`, and a
 * Result<T> envelope.
 *
 * Pre-existing functions (getTasks, createTask, updateTask, updateTaskStatus,
 * updateTaskAssignee, getTasksWithDueDate, deleteTask) still use bare
 * `prisma` + `requireUserId` and throw on error. They are pending the
 * post-3.3 sibling-uplift mini-phase (3.2.x) and are intentionally left
 * untouched here to keep the 3.2 PR scoped.
 */

import { requireUserId } from "@/actions/requireUserId";
import { getServerScopedPrisma, getServerUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function getTasks() {
  const userId = await requireUserId();
  return prisma.task.findMany({
    where: { userId },
    include: { case: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTask(data: {
  caseId?: string;
  description: string;
  dueDate?: Date;
  assignee?: string;
}) {
  const userId = await requireUserId();

  if (data.caseId) {
    const caseItem = await prisma.case.findFirst({
      where: { id: data.caseId, userId },
      select: { id: true },
    });
    if (!caseItem) throw new Error("Case not found or unauthorized");
  }

  await prisma.task.create({
    data: {
      userId,
      caseId: data.caseId as string,
      description: data.description,
      dueDate: data.dueDate ?? null,
      assignee: data.assignee ?? "Unassigned",
      status: "pending",
    },
  });

  revalidatePath("/tasks");
  if (data.caseId) revalidatePath(`/cases/${data.caseId}`);
}

export async function updateTask(
  id: string,
  data: { description?: string; dueDate?: Date | null; caseId?: string | null },
) {
  const userId = await requireUserId();

  if (data.caseId) {
    const caseItem = await prisma.case.findFirst({
      where: { id: data.caseId, userId },
      select: { id: true },
    });
    if (!caseItem) throw new Error("Case not found or unauthorized");
  }

  const result = await prisma.task.updateMany({
    where: { id, userId },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
      ...(data.caseId != null && { caseId: data.caseId }),
    },
  });

  if (!result.count) throw new Error("Unauthorized");

  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

export async function updateTaskStatus(id: string, status: "pending" | "completed") {
  const userId = await requireUserId();
  const result = await prisma.task.updateMany({
    where: { id, userId },
    data: { status },
  });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/tasks");
}

export async function updateTaskAssignee(id: string, assignee: string) {
  const userId = await requireUserId();
  const result = await prisma.task.updateMany({
    where: { id, userId },
    data: { assignee },
  });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/tasks");
}

export async function getTasksWithDueDate() {
  const userId = await requireUserId();
  return prisma.task.findMany({
    where: { userId, status: "pending", dueDate: { not: null } },
    select: {
      id: true,
      description: true,
      dueDate: true,
      case: { select: { id: true, title: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function deleteTask(id: string) {
  const userId = await requireUserId();
  const result = await prisma.task.deleteMany({
    where: { id, userId },
  });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/tasks");
}

// ─── Phase 3.2 — case-scoped task actions (moved from caseActions.ts) ─────────

const createCaseTaskSchema = z.object({
  caseId: z.string().min(1, "caseId required"),
  description: z.string().min(1, "Description required"),
  dueDate: z.coerce.date().optional(),
  isUrgent: z.boolean().default(false),
});

export async function createCaseTask(input: {
  caseId: string;
  description: string;
  dueDate?: Date;
  isUrgent?: boolean;
}): Promise<Result<{ id: string }>> {
  const parsed = createCaseTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  // Defence-in-depth: confirm parent case belongs to user.
  const parent = await db.case.findFirst({
    where: { id: parsed.data.caseId, userId: user.id },
    select: { id: true },
  });
  if (!parent) return { ok: false, error: "Case not found" };

  const task = await db.task.create({
    data: {
      userId: user.id,
      caseId: parsed.data.caseId,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate ?? null,
      status: "pending",
      isUrgent: parsed.data.isUrgent,
    },
    select: { id: true },
  });

  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/tasks");
  return { ok: true, data: { id: task.id } };
}

const toggleCaseTaskStatusSchema = z.object({
  id: z.string().min(1, "Task id required"),
  currentStatus: z.string().min(1),
  caseId: z.string().min(1, "caseId required"),
});

export async function toggleCaseTaskStatus(
  id: string,
  currentStatus: string,
  caseId: string,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = toggleCaseTaskStatusSchema.safeParse({ id, currentStatus, caseId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  const newStatus = parsed.data.currentStatus === "pending" ? "completed" : "pending";

  const result = await db.task.updateMany({
    where: { id: parsed.data.id, userId: user.id, caseId: parsed.data.caseId },
    data: { status: newStatus },
  });

  if (!result.count) return { ok: false, error: "Task not found" };

  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/tasks");
  return { ok: true, data: { id: parsed.data.id, status: newStatus } };
}

const deleteCaseTaskSchema = z.object({
  id: z.string().min(1, "Task id required"),
  caseId: z.string().min(1, "caseId required"),
});

export async function deleteCaseTask(
  id: string,
  caseId: string,
): Promise<Result<{ id: string }>> {
  const parsed = deleteCaseTaskSchema.safeParse({ id, caseId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  const result = await db.task.deleteMany({
    where: { id: parsed.data.id, userId: user.id, caseId: parsed.data.caseId },
  });

  if (!result.count) return { ok: false, error: "Task not found" };

  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/tasks");
  return { ok: true, data: { id: parsed.data.id } };
}

// ─── Phase 4-A — global listAllTasks (3.2-compliant) ─────────────────────────

const listAllTasksSchema = z.object({}).strict();

export type TaskRow = {
  id: string;
  description: string;
  status: string;
  dueDate: Date | null;
  assignee: string;
  isUrgent: boolean;
  createdAt: Date;
  updatedAt: Date;
  caseId: string;
  case: { id: string; title: string; caseNumber: string | null };
};

export async function listAllTasks(): Promise<Result<TaskRow[]>> {
  const parsed = listAllTasksSchema.safeParse({});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  const rows = await db.task.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      description: true,
      status: true,
      dueDate: true,
      assignee: true,
      isUrgent: true,
      createdAt: true,
      updatedAt: true,
      caseId: true,
      case: { select: { id: true, title: true, caseNumber: true } },
    },
    orderBy: [
      { isUrgent: "desc" },
      { dueDate: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });

  return { ok: true, data: rows };
}

// ─── Phase 4-A.4 — updateCaseTask ────────────────────────────────────────────

const updateCaseTaskSchema = z.object({
  taskId: z.string().uuid(),
  description: z.string().trim().min(1).max(500),
  assignee: z.string().trim().min(1).max(100),
  dueDate: z.coerce.date().nullable(),
  isUrgent: z.boolean(),
});

export type UpdateCaseTaskInput = z.infer<typeof updateCaseTaskSchema>;

export async function updateCaseTask(
  input: UpdateCaseTaskInput,
): Promise<Result<TaskRow>> {
  const parsed = updateCaseTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const user = await getServerUser();
    const db = await getServerScopedPrisma();

    const existing = await db.task.findFirst({
      where: { id: parsed.data.taskId, case: { userId: user.id } },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "NOT_FOUND" };

    const updated = await db.task.update({
      where: { id: parsed.data.taskId },
      data: {
        description: parsed.data.description,
        assignee: parsed.data.assignee,
        dueDate: parsed.data.dueDate,
        isUrgent: parsed.data.isUrgent,
      },
      select: {
        id: true,
        description: true,
        status: true,
        dueDate: true,
        assignee: true,
        isUrgent: true,
        createdAt: true,
        updatedAt: true,
        caseId: true,
        case: { select: { id: true, title: true, caseNumber: true } },
      },
    });

    revalidatePath("/tasks");
    revalidatePath(`/cases/${updated.caseId}`);
    return { ok: true, data: updated };
  } catch (e) {
    console.error("[updateCaseTask]", e);
    return { ok: false, error: "INTERNAL_ERROR" };
  }
}
