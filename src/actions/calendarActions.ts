"use server";

import { requireUserId } from "@/actions/requireUserId";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getCalendarEvents() {
  const userId = await requireUserId();
  return prisma.calendarEvent.findMany({
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
}) {
  const userId = await requireUserId();

  const caseItem = await prisma.case.findFirst({
    where: { id: data.caseId, userId },
    select: { id: true },
  });

  if (!caseItem) {
    throw new Error("Unauthorized");
  }

  await prisma.calendarEvent.create({
    data: {
      userId,
      caseId: data.caseId,
      title: data.title,
      hearingDate: data.hearingDate,
      description: data.description ?? null,
    },
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function updateCalendarEvent(
  id: string,
  data: { title?: string; hearingDate?: Date; description?: string }
) {
  const userId = await requireUserId();

  const result = await prisma.calendarEvent.updateMany({
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
}

export async function deleteCalendarEvent(id: string) {
  const userId = await requireUserId();
  const result = await prisma.calendarEvent.deleteMany({ where: { id, userId } });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function getCasesForSelect() {
  const userId = await requireUserId();
  return prisma.case.findMany({
    where: { userId, status: "active" },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}
