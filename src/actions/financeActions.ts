"use server";

import { requireUserId } from "@/actions/requireUserId";
import {
  getServerScopedPrisma,
  withServerUserContext,
} from "@/lib/session";
import { revalidatePath } from "next/cache";

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

export async function getFinancesData(): Promise<FinancesData> {
  const userId = await requireUserId();
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
    totals: {
      expected: totalExpected,
      received: totalReceived,
      balance: totalBalance,
      collectionRate,
    },
    forgottenDues,
    caseRows,
  };
}

export async function updateCaseAgreedFee(caseId: string, agreedFee: number) {
  const userId = await requireUserId();
  const scoped = await getServerScopedPrisma();

  const result = await scoped.case.updateMany({
    where: { id: caseId, userId },
    data: { agreedFee },
  });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/finances");
}

export async function createPayment(data: {
  caseId: string;
  amount: number;
  status?: string;
  dueDate?: Date;
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

    await tx.payment.create({
      data: {
        userId,
        caseId: data.caseId,
        amount: data.amount,
        status: data.status ?? "paid",
        dueDate: data.dueDate ?? null,
      },
    });
  });

  revalidatePath("/finances");
}

export async function deletePayment(id: string) {
  const userId = await requireUserId();
  const scoped = await getServerScopedPrisma();

  const result = await scoped.payment.deleteMany({ where: { id, userId } });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/finances");
}
