/**
 * Dev seed — two users, each with isolated data.
 *
 * RUN VIA OWNER CONNECTION (DIRECT_URL): bypasses RLS so it can write across
 * users. Don't run this via the restricted lawdger_app role — the RLS policies
 * would block writes that don't match the current GUC user.
 *
 * Invocation:
 *   npx dotenv -e .env.local -- npx prisma db seed
 *
 * Idempotent: re-running upserts the users and re-creates the labelled
 * Cases/Notes/Tasks if missing.
 */

import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

const USER_A_EMAIL = "jainsahil2897@gmail.com"
const USER_B_EMAIL = "userB@test.local"
const DEV_PASSWORD = "devpassword123"

async function ensureUser(email: string, name: string) {
  const password = await hash(DEV_PASSWORD, 10)
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, password },
  })
}

async function ensureFixtures(userId: string, prefix: "A" | "B") {
  const caseTitles = [`${prefix}-Case-1`, `${prefix}-Case-2`]

  for (const title of caseTitles) {
    const existing = await prisma.case.findFirst({
      where: { userId, title },
    })
    const c =
      existing ??
      (await prisma.case.create({
        data: {
          userId,
          title,
          clientName: `${prefix}-Client`,
          status: "active",
        },
      }))

    const noteContent = `${prefix}-Note for ${title}`
    const noteExists = await prisma.note.findFirst({
      where: { caseId: c.id, cleanContent: noteContent },
    })
    if (!noteExists) {
      await prisma.note.create({
        data: {
          caseId: c.id,
          userId,
          cleanContent: noteContent,
          category: "General Note",
        },
      })
    }

    const taskDesc = `${prefix}-Task for ${title}`
    const taskExists = await prisma.task.findFirst({
      where: { caseId: c.id, description: taskDesc },
    })
    if (!taskExists) {
      await prisma.task.create({
        data: {
          caseId: c.id,
          userId,
          description: taskDesc,
          status: "pending",
        },
      })
    }
  }
}

async function main() {
  const userA = await ensureUser(USER_A_EMAIL, "Sahil (A)")
  const userB = await ensureUser(USER_B_EMAIL, "User B")

  await ensureFixtures(userA.id, "A")
  await ensureFixtures(userB.id, "B")

  console.log("Seed OK")
  console.log(`  userA: ${userA.email} (${userA.id})`)
  console.log(`  userB: ${userB.email} (${userB.id})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
