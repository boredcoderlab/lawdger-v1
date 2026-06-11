"use server";

/**
 * Phase 3.2 — extracted from caseActions.ts.
 *
 * Notes module follows the same contract as caseActions:
 *   - Zod-validated input
 *   - getServerUser() for auth (redirects on unauth)
 *   - getServerScopedPrisma() for tenant isolation via RLS
 *   - `where: { userId }` as defence-in-depth alongside RLS
 *   - Result<T> = { ok: true; data: T } | { ok: false; error: string }
 *
 * RLS is the primary isolation guarantee; the app-layer userId filter is
 * a seatbelt against future RLS misconfiguration on migration.
 */

import { getServerScopedPrisma, getServerUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const NOTE_CATEGORIES = [
  "General Note",
  "Client Update",
  "Next Date",
  "Task",
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

const createNoteSchema = z.object({
  caseId: z.string().min(1, "caseId required"),
  cleanContent: z.string().min(1, "Note content required"),
  category: z.enum(NOTE_CATEGORIES),
  rawTranscript: z.string().optional(),
  source: z.enum(["manual", "voice"]).optional(),
});

export async function createNote(input: {
  caseId: string;
  cleanContent: string;
  category: NoteCategory;
  rawTranscript?: string;
  source?: "manual" | "voice";
}): Promise<Result<{ id: string }>> {
  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  // Defence-in-depth: confirm case belongs to user before writing note.
  const parent = await db.case.findFirst({
    where: { id: parsed.data.caseId, userId: user.id },
    select: { id: true },
  });
  if (!parent) return { ok: false, error: "Case not found" };

  const note = await db.note.create({
    data: {
      userId: user.id,
      caseId: parsed.data.caseId,
      cleanContent: parsed.data.cleanContent,
      category: parsed.data.category,
      rawTranscript: parsed.data.rawTranscript ?? null,
    },
    select: { id: true },
  });

  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/dashboard");
  return { ok: true, data: { id: note.id } };
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
  const db = await getServerScopedPrisma();

  const result = await db.note.deleteMany({
    where: { id: parsed.data.id, userId: user.id, caseId: parsed.data.caseId },
  });

  if (!result.count) return { ok: false, error: "Note not found" };

  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath("/dashboard");
  return { ok: true, data: { id: parsed.data.id } };
}
