"use server";

/**
 * Mixed contract module.
 *
 * All functions in this file follow the 3.2 contract: Zod input,
 * RLS-scoped Prisma via getServerScopedPrisma/withServerUserContext,
 * defence-in-depth `where: { userId }`, and a Result<T> envelope.
 *
 * Note: createTask/updateTask require caseId (Task.caseId is NOT NULL,
 * FK ON DELETE RESTRICT — see prisma/schema.prisma). The Calendar "— No
 * Case (Independent Task)" UI option (CalendarClient.tsx) is a pre-existing
 * mismatch with this constraint, deferred to a separate PR.
 */

import {
  getServerScopedPrisma,
  getServerUser,
  withServerUserContext,
} from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const createTaskSchema = z.object({
  caseId: z.string().uuid(),
  description: z.string().trim().min(1).max(500),
  dueDate: z.coerce.date().nullable(),
  assignee: z.string().trim().min(1).max(100).nullable(),
});

export async function createTask(
  data: z.input<typeof createTaskSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = createTaskSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();

  const result = await withServerUserContext(async (tx) => {
    const caseItem = await tx.case.findFirst({
      where: { id: parsed.data.caseId, userId: user.id },
      select: { id: true },
    });
    if (!caseItem) {
      return { ok: false, error: "Case not found or unauthorized" } as const;
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
    revalidatePath(`/cases/${parsed.data.caseId}`);
  }
  return result;
}

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(1).max(500).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  caseId: z.string().uuid().optional(),
}).refine(
  (d) => d.description !== undefined || d.dueDate !== undefined || d.caseId !== undefined,
  { message: "At least one field required for update" }
);

export async function updateTask(
  id: string,
  data: { description?: string; dueDate?: Date | null; caseId?: string | null },
): Promise<Result<{ id: string }>> {
  // caseId: null means "no change" (Task.caseId is NOT NULL — see createTask
  // doc comment above). Matches pre-uplift no-op-on-null semantics so
  // existing callers passing null (e.g. dispatch.ts unlink intent) don't crash.
  const parsed = updateTaskSchema.safeParse({
    id,
    description: data.description,
    dueDate: data.dueDate,
    caseId: data.caseId ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();
  let oldCaseId: string | null = null;

  const result = await withServerUserContext(async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id: parsed.data.id, userId: user.id },
      select: { caseId: true },
    });
    if (!existing) {
      return { ok: false, error: "Task not found" } as const;
    }
    oldCaseId = existing.caseId;

    if (parsed.data.caseId) {
      const caseItem = await tx.case.findFirst({
        where: { id: parsed.data.caseId, userId: user.id },
        select: { id: true },
      });
      if (!caseItem) {
        return { ok: false, error: "Case not found or unauthorized" } as const;
      }
    }

    await tx.task.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.dueDate !== undefined && { dueDate: parsed.data.dueDate }),
        ...(parsed.data.caseId !== undefined && { caseId: parsed.data.caseId }),
      },
    });

    return { ok: true, data: { id: parsed.data.id } } as const;
  });

  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    if (parsed.data.caseId) revalidatePath(`/cases/${parsed.data.caseId}`);
    if (oldCaseId && oldCaseId !== parsed.data.caseId) revalidatePath(`/cases/${oldCaseId}`);
  }
  return result;
}

const deleteTaskSchema = z.object({
  id: z.string().uuid(),
});

export async function deleteTask(id: string): Promise<Result<{ id: string }>> {
  const parsed = deleteTaskSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id" };
  }

  const user = await getServerUser();

  const result = await withServerUserContext(async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id: parsed.data.id, userId: user.id },
      select: { caseId: true },
    });
    if (!existing) {
      return { ok: false, error: "Task not found" } as const;
    }

    await tx.task.delete({ where: { id: parsed.data.id } });

    return { ok: true, data: { id: parsed.data.id, caseId: existing.caseId } } as const;
  });

  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath(`/cases/${result.data.caseId}`);
    return { ok: true, data: { id: result.data.id } };
  }
  return result;
}

const updateTaskAssigneeSchema = z.object({
  id: z.string().uuid(),
  assignee: z.string().trim().min(1).max(100).nullable(),
});

export async function updateTaskAssignee(
  id: string,
  assignee: string | null,
): Promise<Result<{ id: string }>> {
  const parsed = updateTaskAssigneeSchema.safeParse({ id, assignee });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();

  const result = await withServerUserContext(async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id: parsed.data.id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return { ok: false, error: "Task not found" } as const;
    }

    await tx.task.update({
      where: { id: parsed.data.id },
      data: { assignee: parsed.data.assignee ?? "Unassigned" },
    });

    return { ok: true, data: { id: parsed.data.id } } as const;
  });

  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
  }
  return result;
}

export type TaskWithDueDateRow = {
  id: string;
  description: string;
  dueDate: Date | null;
  case: { id: string; title: string } | null;
};

export async function getTasksWithDueDate(): Promise<Result<TaskWithDueDateRow[]>> {
  const user = await getServerUser();
  const scoped = await getServerScopedPrisma();

  const rows = await scoped.task.findMany({
    where: { userId: user.id, status: "pending", dueDate: { not: null } },
    select: {
      id: true,
      description: true,
      dueDate: true,
      case: { select: { id: true, title: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return { ok: true, data: rows };
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
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    return { ok: true, data: updated };
  } catch (e) {
    console.error("[updateCaseTask]", e);
    return { ok: false, error: "INTERNAL_ERROR" };
  }
}
