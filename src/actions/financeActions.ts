"use server";

import { requireUserId } from "@/actions/requireUserId";
import {
  getServerScopedPrisma,
  withServerUserContext,
} from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function getFinancesData() {
  const userId = await requireUserId();
  const scoped = await getServerScopedPrisma();
  return scoped.case.findMany({
    where: { userId },
    include: { payments: true },
    orderBy: { createdAt: "desc" },
  });
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
