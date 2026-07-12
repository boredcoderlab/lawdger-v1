"use server";

import {
  getServerScopedPrisma,
  getServerUser,
  withServerUserContext,
} from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Result } from "@/lib/result";

const STAGNANT_DAYS = 60;

export type FinanceStatus = "No Fee Set" | "Paid" | "Partial" | "Unpaid";

export type FinanceCaseRow = {
  id: string;
  title: string;
  agreedFee: number | null;
  received: number;
  balance: number;
  status: FinanceStatus;
  payments: Array<{ id: string; amount: number; createdAt: Date }>;
};

export type FinanceForgottenDue = {
  caseId: string;
  title: string;
  balance: number;
  daysInactive: number;
};

export type FinanceTotals = {
  expected: number;
  received: number;
  balance: number;
  collectionRate: number;
};

export type FinancesData = {
  totals: FinanceTotals;
  forgottenDues: FinanceForgottenDue[];
  caseRows: FinanceCaseRow[];
};

const getFinancesDataSchema = z.object({}).strict();

export async function getFinancesData(): Promise<Result<FinancesData>> {
  const parsed = getFinancesDataSchema.safeParse({});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id: userId } = await getServerUser();
  const scoped = await getServerScopedPrisma();

  const cases = await scoped.case.findMany({
    where: { userId },
    include: { payments: true },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  const caseRows: FinanceCaseRow[] = [];
  const forgottenDues: FinanceForgottenDue[] = [];
  let totalExpected = 0;
  let totalReceived = 0;

  for (const c of cases) {
    const agreedFee = c.agreedFee;
    const paidPayments = c.payments.filter((p) => p.status === "paid");
    const received = paidPayments.reduce((a, p) => a + p.amount, 0);
    const balance = (agreedFee ?? 0) - received;

    const status: FinanceStatus = !agreedFee
      ? "No Fee Set"
      : balance <= 0
      ? "Paid"
      : received > 0
      ? "Partial"
      : "Unpaid";

    caseRows.push({
      id: c.id,
      title: c.title,
      agreedFee,
      received,
      balance,
      status,
      payments: c.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        createdAt: p.createdAt,
      })),
    });

    totalExpected += agreedFee ?? 0;
    totalReceived += received;

    if (balance > 0) {
      const lastActivity = c.payments.length > 0
        ? Math.max(...c.payments.map((p) => p.createdAt.getTime()))
        : 0;
      const daysInactive = lastActivity
        ? Math.floor((now - lastActivity) / 86400000)
        : 999;

      if (daysInactive > STAGNANT_DAYS) {
        forgottenDues.push({
          caseId: c.id,
          title: c.title,
          balance,
          daysInactive,
        });
      }
    }
  }

  const totalBalance = totalExpected - totalReceived;
  const collectionRate = totalExpected > 0
    ? Math.round((totalReceived / totalExpected) * 100)
    : 0;

  return {
    ok: true,
    data: {
      totals: {
        expected: totalExpected,
        received: totalReceived,
        balance: totalBalance,
        collectionRate,
      },
      forgottenDues,
      caseRows,
    },
  };
}

const updateCaseAgreedFeeSchema = z.object({
  caseId: z.string().uuid(),
  agreedFee: z.number().nonnegative(),
});

export async function updateCaseAgreedFee(
  caseId: string,
  agreedFee: number,
): Promise<Result<{ caseId: string; agreedFee: number }>> {
  const parsed = updateCaseAgreedFeeSchema.safeParse({ caseId, agreedFee });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id: userId } = await getServerUser();
  const scoped = await getServerScopedPrisma();

  const result = await scoped.case.updateMany({
    where: { id: parsed.data.caseId, userId },
    data: { agreedFee: parsed.data.agreedFee },
  });

  if (!result.count) {
    return { ok: false, error: "Case not found" };
  }

  revalidatePath("/finances");
  revalidatePath("/cases/[id]", "page");
  revalidatePath("/dashboard");
  return { ok: true, data: { caseId: parsed.data.caseId, agreedFee: parsed.data.agreedFee } };
}

const createPaymentSchema = z.object({
  caseId: z.string().uuid(),
  amount: z.number().positive(),
  status: z.enum(["paid", "pending"]).optional(),
  dueDate: z.coerce.date().optional(),
});

export async function createPayment(
  data: z.input<typeof createPaymentSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = createPaymentSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id: userId } = await getServerUser();

  const result = await withServerUserContext(async (tx) => {
    const caseItem = await tx.case.findFirst({
      where: { id: parsed.data.caseId, userId },
      select: { id: true },
    });

    if (!caseItem) {
      return { ok: false, error: "Case not found" } as const;
    }

    const created = await tx.payment.create({
      data: {
        userId,
        caseId: parsed.data.caseId,
        amount: parsed.data.amount,
        status: parsed.data.status ?? "paid",
        dueDate: parsed.data.dueDate ?? null,
      },
    });

    return { ok: true, data: { id: created.id } } as const;
  });

  if (result.ok) {
    revalidatePath("/finances");
    revalidatePath("/dashboard");
    revalidatePath(`/cases/${parsed.data.caseId}`);
  }
  return result;
}

const deletePaymentSchema = z.object({
  id: z.string().uuid(),
});

export async function deletePayment(id: string): Promise<Result<{ id: string }>> {
  const parsed = deletePaymentSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id" };
  }

  const { id: userId } = await getServerUser();
  const scoped = await getServerScopedPrisma();

  const payment = await scoped.payment.findFirst({
    where: { id: parsed.data.id, userId },
    select: { caseId: true },
  });
  if (!payment) {
    return { ok: false, error: "Payment not found" };
  }

  await scoped.payment.deleteMany({ where: { id: parsed.data.id, userId } });

  revalidatePath("/finances");
  revalidatePath("/dashboard");
  revalidatePath(`/cases/${payment.caseId}`);
  return { ok: true, data: { id: parsed.data.id } };
}
