"use server";

/**
 * Mixed contract module.
 *
 * createTask, updateTask, deleteTask, updateTaskStatus (independent-task
 * path, phase 3.2.6) and createCaseTask, toggleCaseTaskStatus, deleteCaseTask
 * (phase 3.2) follow the 3.2 contract: Zod input, RLS-scoped Prisma via
 * withServerUserContext/getServerScopedPrisma, defence-in-depth
 * `where: { userId }`, and a Result<T> envelope.
 *
 * getTasks, updateTaskAssignee, getTasksWithDueDate still use bare `prisma`
 * + `requireUserId` and throw on error. They are pending the post-3.3
 * sibling-uplift mini-phase (3.2.x) and are intentionally left untouched
 * here to keep the 3.2.6 PR scoped.
 */

import { requireUserId } from "@/actions/requireUserId";
import { getServerScopedPrisma, getServerUser, withServerUserContext } from "@/lib/session";
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

const createTaskSchema = z.object({
  caseId: z.string().uuid().nullable(),
  description: z.string().trim().min(1).max(500),
  dueDate: z.coerce.date().nullable(),
  assignee: z.string().trim().min(1).max(100).nullable(),
});

export async function createTask(
  data: z.input<typeof createTaskSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = createTaskSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await getServerUser();
  const result = await withServerUserContext(async (tx) => {
    if (parsed.data.caseId) {
      const caseItem = await tx.case.findFirst({
        where: { id: parsed.data.caseId, userId: user.id },
        select: { id: true },
      });
      if (!caseItem) return { ok: false, error: "Case not found or unauthorized" } as const;
    }
    const task = await tx.task.create({
      data: {
        userId: user.id,
        caseId: parsed.data.caseId,
        description: parsed.data.description,
        dueDate: parsed.data.dueDate,
        assignee: parsed.data.assignee ?? "Unassigned",
        status: "pending",
      },
      select: { id: true },
    });
    return { ok: true, data: { id: task.id } } as const;
  });

  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    if (parsed.data.caseId) revalidatePath(`/cases/${parsed.data.caseId}`);
  }
  return result;
}

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(1).max(500).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  caseId: z.string().uuid().nullable().optional(),
}).refine(
  (d) => d.description !== undefined || d.dueDate !== undefined || d.caseId !== undefined,
  { message: "At least one field required for update" }
);

export async function updateTask(
  id: string,
  data: { description?: string; dueDate?: Date | null; caseId?: string | null },
): Promise<Result<{ id: string }>> {
  const parsed = updateTaskSchema.safeParse({ id, ...data });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await getServerUser();
  const result = await withServerUserContext(async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id: parsed.data.id, userId: user.id },
      select: { id: true, caseId: true },
    });
    if (!existing) return { ok: false, error: "Task not found or not yours" } as const;

    if (parsed.data.caseId) {
      const caseItem = await tx.case.findFirst({
        where: { id: parsed.data.caseId, userId: user.id },
        select: { id: true },
      });
      if (!caseItem) return { ok: false, error: "Case not found or unauthorized" } as const;
    }

    await tx.task.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.dueDate !== undefined && { dueDate: parsed.data.dueDate }),
        ...(parsed.data.caseId !== undefined && { caseId: parsed.data.caseId }),
      },
    });
    return { ok: true, data: { id: parsed.data.id, oldCaseId: existing.caseId } } as const;
  });

  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    if (parsed.data.caseId) revalidatePath(`/cases/${parsed.data.caseId}`);
    if (result.data.oldCaseId) revalidatePath(`/cases/${result.data.oldCaseId}`);
    return { ok: true, data: { id: result.data.id } };
  }
  return result;
}

const updateTaskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "completed"]),
});

export async function updateTaskStatus(
  id: string,
  status: "pending" | "completed",
): Promise<Result<{ id: string }>> {
  const parsed = updateTaskStatusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await getServerUser();
  const result = await withServerUserContext(async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id, userId: user.id },
      select: { id: true, caseId: true },
    });
    if (!existing) return { ok: false, error: "Task not found or not yours" } as const;
    await tx.task.update({ where: { id }, data: { status: parsed.data.status } });
    return { ok: true, data: { id: existing.id, caseId: existing.caseId } } as const;
  });

  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    if (result.data.caseId) revalidatePath(`/cases/${result.data.caseId}`);
    return { ok: true, data: { id: result.data.id } };
  }
  return result;
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

const deleteTaskSchema = z.object({ id: z.string().uuid() });

export async function deleteTask(id: string): Promise<Result<{ id: string }>> {
  const parsed = deleteTaskSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await getServerUser();
  const result = await withServerUserContext(async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id, userId: user.id },
      select: { id: true, caseId: true },
    });
    if (!existing) return { ok: false, error: "Task not found or not yours" } as const;
    await tx.task.delete({ where: { id } });
    return { ok: true, data: { id: existing.id, caseId: existing.caseId } } as const;
  });

  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    if (result.data.caseId) revalidatePath(`/cases/${result.data.caseId}`);
    return { ok: true, data: { id: result.data.id } };
  }
  return result;
}

// ─── Phase 3.2 — case-scoped task actions (moved from caseActions.ts) ─────────

const createCaseTaskSchema = z.object({
  caseId: z.string().uuid(),
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
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true, data: { id: task.id } };
}

const toggleCaseTaskStatusSchema = z.object({
  id: z.string().uuid(),
  currentStatus: z.string().min(1),
  caseId: z.string().uuid(),
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
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true, data: { id: parsed.data.id, status: newStatus } };
}

const deleteCaseTaskSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
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
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
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
  caseId: string | null;
  case: { id: string; title: string; caseNumber: string | null } | null;
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
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    return { ok: true, data: updated };
  } catch (e) {
    console.error("[updateCaseTask]", e);
    return { ok: false, error: "INTERNAL_ERROR" };
  }
}
