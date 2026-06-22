"use server";

/**
 * Phase 3.2 — extracted from caseActions.ts.
 *
 * Notes module follows the same contract as caseActions:
 *   - Zod-validated input
 *   - getServerUser() for auth (redirects on unauth)
 *   - withServerUserContext() for tenant isolation via RLS (one
 *     interactive tx per action — required for the note↔CalendarEvent
 *     linkage to commit/rollback atomically)
 *   - `where: { userId }` as defence-in-depth alongside RLS
 *   - Result<T> = { ok: true; data: T } | { ok: false; error: string }
 *
 * RLS is the primary isolation guarantee; the app-layer userId filter is
 * a seatbelt against future RLS misconfiguration on migration.
 */

import { getServerUser, withServerUserContext } from "@/lib/session";
import { startOfTodayIST } from "@/lib/date";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { NOTE_CATEGORIES, type NoteCategory } from "./noteActions.types";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const createNoteSchema = z.object({
  caseId: z.string().min(1, "caseId required"),
  cleanContent: z.string().min(1, "Note content required"),
  category: z.enum(NOTE_CATEGORIES),
  rawTranscript: z.string().optional(),
  source: z.enum(["manual", "voice"]).optional(),
  nextDate: z.coerce.date().optional(),
});

export async function createNote(input: {
  caseId: string;
  cleanContent: string;
  category: NoteCategory;
  rawTranscript?: string;
  source?: "manual" | "voice";
  nextDate?: Date | string;
}): Promise<Result<{ id: string }>> {
  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();

  // One interactive RLS-scoped transaction so the note write and the
  // auto-event write commit atomically. Without this envelope the two
  // ops would run as separate transactions and a mid-flight failure
  // could leave a Next Date note without its linked CalendarEvent.
  const result = await withServerUserContext(async (tx) => {
    // Defence-in-depth: confirm case belongs to user before writing note.
    const parent = await tx.case.findFirst({
      where: { id: parsed.data.caseId, userId: user.id },
      select: { id: true, title: true },
    });
    if (!parent) return null;

    const created = await tx.note.create({
      data: {
        userId: user.id,
        caseId: parsed.data.caseId,
        cleanContent: parsed.data.cleanContent,
        category: parsed.data.category,
        rawTranscript: parsed.data.rawTranscript ?? null,
        nextDate: parsed.data.nextDate ?? null,
      },
      select: { id: true },
    });

    if (
      parsed.data.category === "Next Date" &&
      parsed.data.nextDate &&
      parsed.data.nextDate >= startOfTodayIST()
    ) {
      await tx.calendarEvent.create({
        data: {
          userId: user.id,
          caseId: parsed.data.caseId,
          title: `${parent.title} — Next Date`,
          hearingDate: parsed.data.nextDate,
          description: parsed.data.cleanContent,
          noteId: created.id,
        },
      });
    }

    return { id: created.id };
  });

  if (!result) return { ok: false, error: "Case not found" };

  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true, data: result };
}

const deleteNoteSchema = z.object({
  id: z.string().min(1, "Note id required"),
  caseId: z.string().min(1, "caseId required"),
});

export async function deleteNote(
  id: string,
  caseId: string,
): Promise<Result<{ id: string }>> {
  const parsed = deleteNoteSchema.safeParse({ id, caseId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();

  // Cascade event delete BEFORE the note delete, both inside one
  // interactive RLS-scoped transaction so the note↔event linkage
  // unwinds atomically (symmetric with createNote's auto-event path).
  const count = await withServerUserContext(async (tx) => {
    await tx.calendarEvent.deleteMany({
      where: { noteId: parsed.data.id, userId: user.id },
    });

    const result = await tx.note.deleteMany({
      where: { id: parsed.data.id, userId: user.id, caseId: parsed.data.caseId },
    });

    return result.count;
  });

  if (!count) return { ok: false, error: "Note not found" };

  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true, data: { id: parsed.data.id } };
}
