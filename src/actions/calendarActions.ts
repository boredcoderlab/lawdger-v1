"use server";

import { requireUserId } from "@/actions/requireUserId";
import {
  getServerScopedPrisma,
  withServerUserContext,
} from "@/lib/session";
import { CaseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getCalendarEvents() {
  const userId = await requireUserId();
  const scoped = await getServerScopedPrisma();
  return scoped.calendarEvent.findMany({
    where: { userId },
    include: { case: true },
    orderBy: { hearingDate: "asc" },
  });
}

export async function createCalendarEvent(data: {
  title: string;
  hearingDate: Date;
  description?: string;
  caseId: string;
  noteId?: string;
}) {
  const userId = await requireUserId();

  await withServerUserContext(async (tx) => {
    const caseItem = await tx.case.findFirst({
      where: { id: data.caseId, userId },
      select: { id: true },
    });

    if (!caseItem) {
      throw new Error("Unauthorized");
    }

    await tx.calendarEvent.create({
      data: {
        userId,
        caseId: data.caseId,
        title: data.title,
        hearingDate: data.hearingDate,
        description: data.description ?? null,
        ...(data.noteId !== undefined && { noteId: data.noteId }),
      },
    });
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/cases/[id]", "page");
}

export async function updateCalendarEvent(
  id: string,
  data: { title?: string; hearingDate?: Date; description?: string }
) {
  const userId = await requireUserId();
  const scoped = await getServerScopedPrisma();

  const result = await scoped.calendarEvent.updateMany({
    where: { id, userId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.hearingDate && { hearingDate: data.hearingDate }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/cases/[id]", "page");
}

export async function deleteCalendarEvent(id: string) {
  const userId = await requireUserId();
  const scoped = await getServerScopedPrisma();

  const result = await scoped.calendarEvent.deleteMany({ where: { id, userId } });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/cases/[id]", "page");
}

export async function getCasesForSelect() {
  const userId = await requireUserId();
  const scoped = await getServerScopedPrisma();
  return scoped.case.findMany({
    where: { userId, status: CaseStatus.ACTIVE },
    select: { id: true, title: true, caseNumber: true },
    orderBy: { title: "asc" },
  });
}
