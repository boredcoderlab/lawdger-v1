/**
 * User RLS isolation proof.
 *
 * Run AFTER DATABASE_URL is repointed at the restricted `lawdger_app` role.
 *   npx dotenv -e .env.local -- npx tsx scripts/verify-user-rls.ts
 *
 * Four checks — all must PASS:
 *   1. Scoped client for A can read its own User row (User_self_select
 *      allows self-read).
 *   2. Scoped client for A cannot read B's User row by id (cross-tenant
 *      SELECT blocked).
 *   3. Scoped client for A cannot updateMany B's User row (count=0 —
 *      User_self_update USING clause blocks cross-tenant update).
 *   4. B's row is unchanged when re-read under B's own scope — proves
 *      the attempted update in check 3 did not land anywhere.
 */

import { getPrismaForUser } from "../src/lib/prisma-rls"
import { prisma as baseClient } from "../src/lib/prisma"

const USER_A_EMAIL = "jainsahil2897@gmail.com"
const USER_B_EMAIL = "userb@test.local"

const PROBE_NAME = "RLS_PROBE_SHOULD_NOT_APPLY"

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`)
}

async function main() {
  type AuthUserRow = {
    id: string
    email: string
    name: string | null
    password: string
  }

  const userARows = await baseClient.$queryRaw<AuthUserRow[]>`
    SELECT id, email, name, password
    FROM public.auth_find_user_by_email(${USER_A_EMAIL})
  `
  const userBRows = await baseClient.$queryRaw<AuthUserRow[]>`
    SELECT id, email, name, password
    FROM public.auth_find_user_by_email(${USER_B_EMAIL})
  `
  const userA = userARows[0] ?? null
  const userB = userBRows[0] ?? null

  if (!userA || !userB) {
    throw new Error(
      `Seed users missing — got A=${!!userA} B=${!!userB}. Run \`npx dotenv -e .env.local -- npx prisma db seed\` first.`,
    )
  }

  // Confirm runtime role.
  const roleRows = await baseClient.$queryRaw<{ current_user: string }[]>`
    SELECT current_user
  `
  const role = roleRows[0]?.current_user ?? "unknown"
  console.log(`\nRuntime DB role: ${role}`)
  if (role !== "lawdger_app") {
    console.log(
      `WARN  expected lawdger_app — got ${role}. DATABASE_URL may not be repointed.`,
    )
  }

  const dbA = getPrismaForUser(userA.id)
  const dbB = getPrismaForUser(userB.id)

  // Capture B's original name BEFORE any cross-tenant attempt, so check 4
  // has a known-good baseline and no cleanup is needed — the probe value
  // never lands anywhere if RLS holds.
  const bBefore = await dbB.user.findUnique({
    where: { id: userB.id },
    select: { name: true },
  })
  const originalNameB = bBefore?.name ?? null

  // Check 1 — A can read its own User row (positive control).
  const selfA = await dbA.user.findUnique({ where: { id: userA.id } })
  const selfOk =
    selfA !== null && selfA.id === userA.id && selfA.email === USER_A_EMAIL
  record(
    "1. scoped(A) findUnique(self) → own row",
    selfOk,
    selfA
      ? `id=${selfA.id} email=${selfA.email}`
      : "returned null — User_self_select blocked self-read",
  )

  // Check 2 — A cannot read B's User row by id (cross-tenant SELECT).
  const crossRead = await dbA.user.findUnique({ where: { id: userB.id } })
  record(
    "2. scoped(A) findUnique(B's id) → null",
    crossRead === null,
    crossRead ? `LEAK: got ${JSON.stringify(crossRead)}` : "returned null as expected",
  )

  // Check 3 — A cannot updateMany B's User row (cross-tenant UPDATE, count).
  const crossUpdate = await dbA.user.updateMany({
    where: { id: userB.id },
    data: { name: PROBE_NAME },
  })
  record(
    "3. scoped(A) updateMany(B's id) → count=0",
    crossUpdate.count === 0,
    `count=${crossUpdate.count}`,
  )

  // Check 4 — B's row unchanged when re-read under B's own scope.
  const bAfter = await dbB.user.findUnique({
    where: { id: userB.id },
    select: { name: true },
  })
  const stateOk = bAfter !== null && bAfter.name !== PROBE_NAME && bAfter.name === originalNameB
  record(
    "4. scoped(B) re-read of self → name unchanged by A's attempt",
    stateOk,
    bAfter
      ? `name="${bAfter.name}" (expected "${originalNameB}")`
      : "row missing — B's User row was deleted or hidden",
  )

  console.log("")
  const allPass = checks.every((c) => c.pass)
  console.log(allPass ? "ALL USER RLS CHECKS PASS" : "FAILURES — User RLS NOT SAFE")
  await baseClient.$disconnect()
  process.exit(allPass ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await baseClient.$disconnect()
  process.exit(1)
})
