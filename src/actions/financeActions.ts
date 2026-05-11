"use server";

import { requireUserId } from "@/actions/requireUserId";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function assertCaseAccess(caseId: string, userId: string) {
  const caseItem = await prisma.case.findFirst({
    where: { id: caseId, userId },
    select: { id: true },
  });

  if (!caseItem) {
    throw new Error("Unauthorized");
  }
}

export async function getFinancesData() {
  const userId = await requireUserId();

  const cases = await prisma.case.findMany({
    where: { userId },
    include: { payments: true },
    orderBy: { createdAt: "desc" },
  });

  return cases;
}

export async function updateCaseAgreedFee(caseId: string, agreedFee: number) {
  const userId = await requireUserId();
  const result = await prisma.case.updateMany({
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

  await assertCaseAccess(data.caseId, userId);

  await prisma.payment.create({
    data: {
      userId,
      caseId: data.caseId,
      amount: data.amount,
      status: data.status ?? "paid",
      dueDate: data.dueDate ?? null,
    },
  });
  revalidatePath("/finances");
}

export async function deletePayment(id: string) {
  const userId = await requireUserId();
  const result = await prisma.payment.deleteMany({ where: { id, userId } });

  if (!result.count) {
    throw new Error("Unauthorized");
  }

  revalidatePath("/finances");
}
