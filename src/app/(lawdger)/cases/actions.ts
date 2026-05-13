"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const CASE_TYPES = [
  "CIVIL",
  "CRIMINAL",
  "WRIT",
  "APPEAL",
  "COMMERCIAL",
  "FAMILY",
  "ARBITRATION",
  "OTHER",
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_STATUSES = [
  "active",
  "pending",
  "closed",
  "urgent",
  "dormant",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

const createCaseSchema = z.object({
  title: z.string().min(2, "Case title required"),
  clientName: z.string().min(2, "Client name required"),
  matterId: z.string().optional(),
  forum: z.string().min(2, "Forum required"),
  court: z.string().min(2, "Court required"),
  caseType: z.enum(CASE_TYPES),
  nextHearingDate: z.string().optional(),
  description: z.string().optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export type CaseRecord = {
  id: string;
  userId: string;
  title: string;
  clientName: string | null;
  courtName: string | null;
  matterId: string | null;
  forum: string | null;
  court: string | null;
  caseType: string | null;
  status: string;
  nextHearingDate: Date | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function createCase(
  input: CreateCaseInput
): Promise<{ success: true; case: CaseRecord } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const parsed = createCaseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const created = await prisma.case.create({
      data: {
        userId: session.user.id,
        title: parsed.data.title,
        clientName: parsed.data.clientName,
        matterId: parsed.data.matterId || null,
        forum: parsed.data.forum,
        court: parsed.data.court,
        // Mirror to legacy field so CaseDetailClient keeps rendering
        courtName: parsed.data.court,
        caseType: parsed.data.caseType,
        nextHearingDate: parsed.data.nextHearingDate
          ? new Date(parsed.data.nextHearingDate)
          : null,
        description: parsed.data.description || null,
      },
    });
    revalidatePath("/cases");
    return { success: true, case: created as CaseRecord };
  } catch {
    return { error: "Failed to create case" };
  }
}

export async function getCases(filter?: CaseStatus): Promise<CaseRecord[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const rows = await prisma.case.findMany({
    where: {
      userId: session.user.id,
      ...(filter ? { status: filter } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows as CaseRecord[];
}

export async function getCaseCounts(): Promise<{
  total: number;
  active: number;
  pending: number;
  closed: number;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { total: 0, active: 0, pending: 0, closed: 0 };
  }

  const userId = session.user.id;
  const [total, active, pending, closed] = await Promise.all([
    prisma.case.count({ where: { userId } }),
    prisma.case.count({ where: { userId, status: "active" } }),
    prisma.case.count({ where: { userId, status: "pending" } }),
    prisma.case.count({ where: { userId, status: "closed" } }),
  ]);

  return { total, active, pending, closed };
}
