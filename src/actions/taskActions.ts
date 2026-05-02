"use server";

import { requireUserId } from "@/actions/requireUserId";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
      caseId: data.caseId ?? null,
      description: data.description,
      dueDate: data.dueDate ?? null,
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
      ...(data.caseId !== undefined && { caseId: data.caseId }),
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
