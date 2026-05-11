"use server";

import { requireUserId } from "@/actions/requireUserId";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function assertCaseAccess(caseId: string, userId: string) {
  const caseItem = await prisma.case.findFirst({
    where: { id: caseId, userId },
    select: { id: true },
  });

  if (!caseItem) {
    throw new Error("Unauthorized");
  }
}

export async function getCases() {
  const userId = await requireUserId();
  return prisma.case.findMany({
    where: { userId },
    include: {
      _count: {
        select: { tasks: true, notes: true, calendarEvents: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCaseById(id: string) {
  const userId = await requireUserId();

  return prisma.case.findFirst({
    where: { id, userId },
    include: {
      tasks: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      calendarEvents: { orderBy: { hearingDate: "asc" } },
    },
  });
}

export async function createCase(data: {
  title: string;
  clientName?: string;
  courtName?: string;
  agreedFee?: number;
}) {
  const userId = await requireUserId();

  await prisma.case.create({
    data: {
      userId,
      title: data.title,
      clientName: data.clientName ?? null,
      courtName: data.courtName ?? null,
      status: "active",
    },
  });
  revalidatePath("/cases");
}

export async function updateCaseDetails(
  id: string,
  data: {
    title?: string;
    clientName?: string | null;
    courtName?: string | null;
    agreedFee?: number | null;
    status?: string;
  }
) {
  const userId = await requireUserId();

  const result = await prisma.case.updateMany({
    where: { id, userId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.clientName !== undefined && { clientName: data.clientName }),
      ...(data.courtName !== undefined && { courtName: data.courtName }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });

  if (!result.count) throw new Error("Unauthorized");

  revalidatePath(`/cases/${id}`);
  revalidatePath("/cases");
}

export async function updateCaseStatus(id: string, status: string) {
  const userId = await requireUserId();

  const result = await prisma.case.updateMany({
    where: { id, userId },
    data: { status },
  });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${id}`);
}

export async function deleteCase(id: string) {
  const userId = await requireUserId();

  await prisma.task.deleteMany({ where: { caseId: id, userId } });
  await prisma.note.deleteMany({ where: { caseId: id, userId } });
  await prisma.calendarEvent.deleteMany({ where: { caseId: id, userId } });
  await prisma.payment.deleteMany({ where: { caseId: id, userId } });

  const result = await prisma.case.deleteMany({ where: { id, userId } });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/cases");
}

export async function createCaseTask(data: {
  caseId: string;
  description: string;
  dueDate?: Date;
}) {
  const userId = await requireUserId();

  await assertCaseAccess(data.caseId, userId);

  await prisma.task.create({
    data: {
      userId,
      caseId: data.caseId,
      description: data.description,
      dueDate: data.dueDate,
      status: "pending",
    },
  });
  revalidatePath(`/cases/${data.caseId}`);
  revalidatePath("/tasks");
}

export async function toggleCaseTaskStatus(
  id: string,
  currentStatus: string,
  caseId: string
) {
  const userId = await requireUserId();
  const newStatus = currentStatus === "pending" ? "completed" : "pending";

  const result = await prisma.task.updateMany({
    where: { id, userId, caseId },
    data: { status: newStatus },
  });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/tasks");
}

export async function deleteCaseTask(id: string, caseId: string) {
  const userId = await requireUserId();
  const result = await prisma.task.deleteMany({ where: { id, userId, caseId } });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/tasks");
}

export type NoteCategory =
  | "General Note"
  | "Client Update"
  | "Next Date"
  | "Task";

export async function createNote(data: {
  caseId: string;
  cleanContent: string;
  category: NoteCategory;
  rawTranscript?: string;
  source?: "manual" | "voice";
}) {
  const userId = await requireUserId();

  await assertCaseAccess(data.caseId, userId);

  await prisma.note.create({
    data: {
      userId,
      caseId: data.caseId,
      cleanContent: data.cleanContent,
      category: data.category,
      rawTranscript: data.rawTranscript ?? null,
    },
  });
  revalidatePath(`/cases/${data.caseId}`);
  revalidatePath("/dashboard");
}

export async function deleteNote(id: string, caseId: string) {
  const userId = await requireUserId();
  const result = await prisma.note.deleteMany({ where: { id, userId, caseId } });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/dashboard");
}
