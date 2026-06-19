"use server";

/**
 * Phase 3.2 — pattern-setting action module.
 *
 * Contract for every exported action:
 *   1. "use server"
 *   2. Zod-validate input.
 *   3. Acquire user via getServerUser() (redirects if unauth).
 *   4. Acquire RLS-scoped Prisma via getServerScopedPrisma() for SINGLE
 *      queries, OR withServerUserContext((tx) => ...) for MULTI-query
 *      actions / actions needing atomicity.
 *   5. Include `where: { userId }` as defence-in-depth alongside RLS.
 *      RLS is the primary isolation guarantee; the app-layer filter is
 *      a seatbelt against future RLS misconfiguration on migration.
 *   6. Return Result<T>:
 *        { ok: true, data: T } | { ok: false, error: string }
 *      Unexpected DB errors may still throw; the envelope is for
 *      known/expected failure modes (validation, not-found, etc.).
 *
 * BANNED in this module and every other scoped-action module:
 *   db.$transaction([a, b, c])                  // array form
 *   Promise.all([db.x.findMany(), db.y.count()]) // parallel scoped ops
 * Both deadlock against the pgbouncer-pooled connection_limit and
 * surface as Prisma P2024. Use withServerUserContext((tx) => { ... })
 * for multi-query atomicity or parallel reads — all queries inside
 * share one connection and one RLS context. See src/lib/prisma-rls.ts
 * for the architecture rationale.
 */

import { CASE_TYPES } from "@/lib/case-constants";
import {
  getServerScopedPrisma,
  getServerUser,
  withServerUserContext,
} from "@/lib/session";
import {
  CaseStatus,
  MatterType,
  type CalendarEvent,
  type Case,
  type Note,
  type Task,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Shared Zod fragments ────────────────────────────────────────────────────

const idSchema = z.string().min(1, "id required");

const caseWritableSchema = z.object({
  title: z.string().min(1, "Case title required"),
  clientName: z.string().optional(),
  court: z.string().optional(),
  caseNumber: z.string().optional(),
  caseType: z.enum(CASE_TYPES),
  matterType: z.nativeEnum(MatterType).default(MatterType.LITIGATION),
  nextHearingDate: z.coerce.date().optional(),
  description: z.string().optional(),
  filingDate: z.coerce.date().optional(),
  actsSections: z.string().optional(),
  firNumber: z.string().optional(),
  policeStation: z.string().optional(),
  agreedFee: z.coerce.number().nonnegative().optional(),
});

type CaseWritableInput = z.input<typeof caseWritableSchema>;
type CaseWritableParsed = z.output<typeof caseWritableSchema>;

function toCreateData(parsed: CaseWritableParsed, userId: string) {
  return {
    userId,
    title: parsed.title,
    clientName: parsed.clientName ?? null,
    court: parsed.court ?? null,
    caseNumber: parsed.caseNumber ?? null,
    caseType: parsed.caseType,
    matterType: parsed.matterType,
    nextHearingDate: parsed.nextHearingDate ?? null,
    description: parsed.description ?? null,
    filingDate: parsed.filingDate ?? null,
    actsSections: parsed.actsSections ?? null,
    firNumber: parsed.firNumber ?? null,
    policeStation: parsed.policeStation ?? null,
    agreedFee: parsed.agreedFee ?? null,
  };
}

// Maps a partial parsed payload to a Prisma update payload, only including
// keys the caller explicitly supplied (so we don't accidentally null out
// fields they didn't intend to change).
function toUpdateData(
  parsed: Partial<CaseWritableParsed>,
  raw: Partial<CaseWritableInput>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const keys: Array<keyof CaseWritableInput> = [
    "title",
    "clientName",
    "court",
    "caseNumber",
    "caseType",
    "matterType",
    "nextHearingDate",
    "description",
    "filingDate",
    "actsSections",
    "firNumber",
    "policeStation",
    "agreedFee",
  ];
  for (const key of keys) {
    if (raw[key] === undefined) continue;
    const value = parsed[key];
    data[key] = value ?? null;
  }
  return data;
}

// ─── createCase ──────────────────────────────────────────────────────────────

export async function createCase(
  input: CaseWritableInput,
): Promise<Result<Case>> {
  const parsed = caseWritableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  const created = await db.case.create({
    data: toCreateData(parsed.data, user.id),
  });

  revalidatePath("/cases");
  return { ok: true, data: created };
}

// ─── listCases ───────────────────────────────────────────────────────────────

const listCasesSchema = z.object({
  status: z.nativeEnum(CaseStatus).optional(),
  q: z.string().min(1).optional(),
  skip: z.number().int().nonnegative().default(0),
  take: z.number().int().positive().max(200).default(50),
});

export async function listCases(
  input?: z.input<typeof listCasesSchema>,
): Promise<Result<{ items: Case[]; total: number }>> {
  const parsed = listCasesSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();
  const { status, q, skip, take } = parsed.data;

  const where = {
    userId: user.id,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { clientName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // Serial findMany + count inside one scoped tx. NOT Promise.all — see
  // BAN note in file header.
  return withServerUserContext(async (tx) => {
    const items = await tx.case.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    });
    const total = await tx.case.count({ where });
    return { ok: true, data: { items, total } };
  });
}

// ─── getCase ─────────────────────────────────────────────────────────────────

export async function getCase(id: string): Promise<Result<Case | null>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  const found = await db.case.findFirst({
    where: { id: parsed.data, userId: user.id },
  });

  return { ok: true, data: found };
}

// ─── getCaseWithChildren ─────────────────────────────────────────────────────

export type CaseWithChildren = Case & {
  tasks: Task[];
  notes: Note[];
  calendarEvents: CalendarEvent[];
};

export async function getCaseWithChildren(
  id: string,
): Promise<Result<CaseWithChildren | null>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  const found = await db.case.findFirst({
    where: { id: parsed.data, userId: user.id },
    include: {
      tasks: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      calendarEvents: { orderBy: { hearingDate: "asc" } },
    },
  });

  return { ok: true, data: found };
}

// ─── updateCase ──────────────────────────────────────────────────────────────

const updateCaseSchema = caseWritableSchema.partial();

export async function updateCase(
  id: string,
  input: z.input<typeof updateCaseSchema>,
): Promise<Result<Case>> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { ok: false, error: parsedId.error.issues[0]?.message ?? "Invalid id" };
  }
  const parsed = updateCaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  const updateData = toUpdateData(parsed.data, input);

  // Two-step so we can return the updated row AND honour `where: { userId }`
  // (updateMany returns count only, update doesn't accept compound where).
  const owned = await db.case.findFirst({
    where: { id: parsedId.data, userId: user.id },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Case not found" };

  const updated = await db.case.update({
    where: { id: parsedId.data },
    data: updateData,
  });

  revalidatePath("/cases");
  revalidatePath(`/cases/${parsedId.data}`);
  return { ok: true, data: updated };
}

// ─── updateCaseStatus ────────────────────────────────────────────────────────

const updateCaseStatusSchema = z.object({
  id: idSchema,
  status: z.nativeEnum(CaseStatus),
});

export async function updateCaseStatus(
  id: string,
  status: CaseStatus,
): Promise<Result<Case>> {
  const parsed = updateCaseStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  const owned = await db.case.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Case not found" };

  const updated = await db.case.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  revalidatePath("/cases");
  revalidatePath(`/cases/${parsed.data.id}`);
  return { ok: true, data: updated };
}

// ─── archiveCase ─────────────────────────────────────────────────────────────

export async function archiveCase(id: string): Promise<Result<Case>> {
  return updateCaseStatus(id, CaseStatus.CLOSED);
}

// ─── getCaseCounts ───────────────────────────────────────────────────────────

export async function getCaseCounts(): Promise<
  Result<{ total: number; active: number; closed: number }>
> {
  const user = await getServerUser();

  // Single groupBy inside one scoped tx — replaces the prior
  // Promise.all of three parallel scoped counts (P2024 deadlock).
  return withServerUserContext(async (tx) => {
    const grouped = await tx.case.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { _all: true },
    });
    const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
    const active =
      grouped.find((g) => g.status === CaseStatus.ACTIVE)?._count._all ?? 0;
    const closed =
      grouped.find((g) => g.status === CaseStatus.CLOSED)?._count._all ?? 0;
    return { ok: true, data: { total, active, closed } };
  });
}

// ─── deleteCase ──────────────────────────────────────────────────────────────

export async function deleteCase(id: string): Promise<Result<{ id: string }>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id" };
  }

  const user = await getServerUser();
  const db = await getServerScopedPrisma();

  // Manual cascade preserved from pre-3.2 behaviour. Schema-level onDelete
  // is 3.2.x territory.
  await db.task.deleteMany({ where: { caseId: parsed.data, userId: user.id } });
  await db.note.deleteMany({ where: { caseId: parsed.data, userId: user.id } });
  await db.calendarEvent.deleteMany({ where: { caseId: parsed.data, userId: user.id } });
  await db.payment.deleteMany({ where: { caseId: parsed.data, userId: user.id } });

  const result = await db.case.deleteMany({
    where: { id: parsed.data, userId: user.id },
  });

  if (!result.count) return { ok: false, error: "Case not found" };

  revalidatePath("/cases");
  return { ok: true, data: { id: parsed.data } };
}
