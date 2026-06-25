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

const updateNoteSchema = z
  .object({
    id: z.string().min(1, "Note id required"),
    caseId: z.string().min(1, "caseId required"),
    cleanContent: z.string().trim().min(1, "Note content required"),
    category: z.enum(NOTE_CATEGORIES),
    nextDate: z.coerce.date().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.category === "Next Date" && !val.nextDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nextDate"],
        message: "nextDate required when category is Next Date",
      });
    }
  });

export async function updateNote(input: {
  id: string;
  caseId: string;
  cleanContent: string;
  category: NoteCategory;
  nextDate?: Date | string | null;
}): Promise<Result<{ id: string }>> {
  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();

  try {
    // One interactive RLS-scoped transaction so the note write and any
    // CalendarEvent re-sync commit atomically — same envelope shape as
    // createNote / deleteNote so the note↔event linkage stays consistent
    // across the 8-row transition matrix (see PR body).
    const result = await withServerUserContext(async (tx) => {
      const parent = await tx.case.findFirst({
        where: { id: parsed.data.caseId, userId: user.id },
        select: { id: true, title: true },
      });
      if (!parent) return { code: "case_not_found" as const };

      const existing = await tx.note.findFirst({
        where: { id: parsed.data.id, caseId: parsed.data.caseId, userId: user.id },
        select: { id: true, category: true, nextDate: true },
      });
      if (!existing) return { code: "note_not_found" as const };

      const newNextDate = parsed.data.nextDate ?? null;

      await tx.note.update({
        where: { id: parsed.data.id },
        data: {
          cleanContent: parsed.data.cleanContent,
          category: parsed.data.category,
          nextDate: newNextDate,
        },
      });

      const wasNextDate = existing.category === "Next Date";
      const isNextDate = parsed.data.category === "Next Date";
      const today = startOfTodayIST();
      const futureDate = !!newNextDate && newNextDate >= today;

      if (wasNextDate && !isNextDate) {
        // Next Date → other: drop linked event.
        await tx.calendarEvent.deleteMany({ where: { noteId: parsed.data.id } });
      } else if (!wasNextDate && isNextDate) {
        // other → Next Date: create event iff date is future (matches createNote).
        if (futureDate && newNextDate) {
          await tx.calendarEvent.create({
            data: {
              userId: user.id,
              caseId: parsed.data.caseId,
              title: `${parent.title} — Next Date`,
              hearingDate: newNextDate,
              description: parsed.data.cleanContent,
              noteId: parsed.data.id,
            },
          });
        }
      } else if (wasNextDate && isNextDate) {
        // Stayed Next Date: 4-way branch on event presence × date future-ness.
        const linkedEvent = await tx.calendarEvent.findFirst({
          where: { noteId: parsed.data.id },
          select: { id: true },
        });
        if (linkedEvent && futureDate && newNextDate) {
          await tx.calendarEvent.update({
            where: { id: linkedEvent.id },
            data: {
              title: `${parent.title} — Next Date`,
              hearingDate: newNextDate,
              description: parsed.data.cleanContent,
            },
          });
        } else if (linkedEvent && !futureDate) {
          // Event was future, now past → drop it (asymmetric with createNote
          // otherwise; calendar should not show past auto-events).
          await tx.calendarEvent.deleteMany({ where: { noteId: parsed.data.id } });
        } else if (!linkedEvent && futureDate && newNextDate) {
          // Stale link (event deleted out-of-band) but date is future →
          // re-create rather than throw.
          await tx.calendarEvent.create({
            data: {
              userId: user.id,
              caseId: parsed.data.caseId,
              title: `${parent.title} — Next Date`,
              hearingDate: newNextDate,
              description: parsed.data.cleanContent,
              noteId: parsed.data.id,
            },
          });
        }
        // else: no event + past date → no-op.
      }
      // else: other → other → no event work.

      return { code: "ok" as const, id: parsed.data.id };
    });

    if (result.code === "case_not_found") return { ok: false, error: "Case not found" };
    if (result.code === "note_not_found") return { ok: false, error: "Note not found" };

    revalidatePath(`/cases/${parsed.data.caseId}`);
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    return { ok: true, data: { id: result.id } };
  } catch (err) {
    console.error("[updateNote] failed", err);
    return { ok: false, error: "Update failed" };
  }
}
