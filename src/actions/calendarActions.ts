"use server";

import {
  getServerScopedPrisma,
  getServerUser,
  withServerUserContext,
} from "@/lib/session";
import { syncNextHearingDate } from "@/lib/calendar-sync";
import { CaseStatus, Prisma, type CalendarEvent } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type Result } from "@/lib/result";

type CalendarEventWithCase = Prisma.CalendarEventGetPayload<{
  include: { case: true };
}>;

type CaseForSelect = Prisma.CaseGetPayload<{
  select: { id: true; title: true; caseNumber: true };
}>;

const getCalendarEventsSchema = z.object({}).strict();

export async function getCalendarEvents(): Promise<
  Result<CalendarEventWithCase[]>
> {
  const parsed = getCalendarEventsSchema.safeParse({});
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { id: userId } = await getServerUser();
  const scoped = await getServerScopedPrisma();
  const events = await scoped.calendarEvent.findMany({
    where: { userId },
    include: { case: true },
    orderBy: { hearingDate: "asc" },
  });
  return { ok: true, data: events };
}

const createCalendarEventSchema = z.object({
  title: z.string().min(1),
  hearingDate: z.coerce.date(),
  description: z.string().nullable().optional(),
  caseId: z.string().uuid(),
  noteId: z.string().uuid().optional(),
});

export async function createCalendarEvent(
  data: z.input<typeof createCalendarEventSchema>,
): Promise<Result<CalendarEvent>> {
  const parsed = createCalendarEventSchema.safeParse(data);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { id: userId } = await getServerUser();

  const result = await withServerUserContext(async (tx) => {
    const caseItem = await tx.case.findFirst({
      where: { id: parsed.data.caseId, userId },
      select: { id: true },
    });

    if (!caseItem) {
      return fail("not_found", "Not authorized");
    }

    const created = await tx.calendarEvent.create({
      data: {
        userId,
        caseId: parsed.data.caseId,
        title: parsed.data.title,
        hearingDate: parsed.data.hearingDate,
        description: parsed.data.description ?? null,
        ...(parsed.data.noteId !== undefined && { noteId: parsed.data.noteId }),
      },
    });

    await syncNextHearingDate(parsed.data.caseId, tx);

    return { ok: true, data: created } as const;
  });

  if (result.ok) {
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/cases/[id]", "page");
  }
  return result;
}

const updateCalendarEventSchema = z.object({
  title: z.string().min(1).optional(),
  hearingDate: z.coerce.date().optional(),
  description: z.string().nullable().optional(),
});

export async function updateCalendarEvent(
  id: string,
  data: z.input<typeof updateCalendarEventSchema>,
): Promise<Result<CalendarEvent>> {
  const parsed = updateCalendarEventSchema.safeParse(data);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { id: userId } = await getServerUser();

  const result = await withServerUserContext(async (tx) => {
    const existing = await tx.calendarEvent.findFirst({
      where: { id, userId },
      select: { caseId: true },
    });

    if (!existing) {
      return fail("not_found", "Not authorized");
    }

    const updated = await tx.calendarEvent.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.hearingDate !== undefined && {
          hearingDate: parsed.data.hearingDate,
        }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
      },
    });

    await syncNextHearingDate(existing.caseId, tx);

    return { ok: true, data: updated } as const;
  });

  if (result.ok) {
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/cases/[id]", "page");
  }
  return result;
}

const deleteCalendarEventSchema = z.object({ id: z.string().uuid() });

export async function deleteCalendarEvent(
  id: string,
): Promise<Result<{ id: string }>> {
  const parsed = deleteCalendarEventSchema.safeParse({ id });
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { id: userId } = await getServerUser();

  const result = await withServerUserContext(async (tx) => {
    const existing = await tx.calendarEvent.findFirst({
      where: { id: parsed.data.id, userId },
      select: { caseId: true },
    });

    if (!existing) {
      return fail("not_found", "Not authorized");
    }

    await tx.calendarEvent.deleteMany({ where: { id: parsed.data.id, userId } });

    await syncNextHearingDate(existing.caseId, tx);

    return { ok: true, data: { id: parsed.data.id } } as const;
  });

  if (result.ok) {
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/cases/[id]", "page");
  }
  return result;
}

const getCasesForSelectSchema = z.object({}).strict();

export async function getCasesForSelect(): Promise<Result<CaseForSelect[]>> {
  const parsed = getCasesForSelectSchema.safeParse({});
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { id: userId } = await getServerUser();
  const scoped = await getServerScopedPrisma();
  const cases = await scoped.case.findMany({
    where: { userId, status: CaseStatus.ACTIVE },
    select: { id: true, title: true, caseNumber: true },
    orderBy: { title: "asc" },
  });
  return { ok: true, data: cases };
}
