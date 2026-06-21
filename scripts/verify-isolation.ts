/**
 * RLS isolation proof.
 *
 * Run AFTER DATABASE_URL is repointed at the restricted `lawdger_app` role.
 *   npx dotenv -e .env.local -- npx tsx scripts/verify-isolation.ts
 *
 * Four checks — all must PASS:
 *   1. Scoped client for A returns only A's cases (count = 2, all A-prefixed).
 *   2. Scoped client for B returns only B's cases (count = 2, all B-prefixed).
 *   3. Bare base client (no GUC set) returns 0 rows — RLS denies by default.
 *   4. A cannot findUnique one of B's cases by id (cross-read blocked).
 *
 * Also reports the runtime DB role — should be `lawdger_app` after repoint.
 */

import { getPrismaForUser } from "../src/lib/prisma-rls"
import { prisma as baseClient } from "../src/lib/prisma"

const USER_A_EMAIL = "jainsahil2897@gmail.com"
const USER_B_EMAIL = "userb@test.local"

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

  // Check 1 — A sees only A.
  const aCases = await dbA.case.findMany({ select: { id: true, title: true, userId: true } })
  const aOk =
    aCases.length === 2 &&
    aCases.every((c) => c.userId === userA.id && c.title.startsWith("A-"))
  record(
    "1. scoped(A) → only A's cases",
    aOk,
    `count=${aCases.length} titles=[${aCases.map((c) => c.title).join(", ")}]`,
  )

  // Check 2 — B sees only B.
  const bCases = await dbB.case.findMany({ select: { id: true, title: true, userId: true } })
  const bOk =
    bCases.length === 2 &&
    bCases.every((c) => c.userId === userB.id && c.title.startsWith("B-"))
  record(
    "2. scoped(B) → only B's cases",
    bOk,
    `count=${bCases.length} titles=[${bCases.map((c) => c.title).join(", ")}]`,
  )

  // Check 3 — bare base client (no GUC) returns 0.
  // Force a fresh connection-less query path: the base client has no extension
  // wrapping it, so no set_config runs. RLS should deny everything.
  let bareCount = -1
  let bareErr: string | null = null
  try {
    const bareCases = await baseClient.case.findMany({ select: { id: true } })
    bareCount = bareCases.length
  } catch (e) {
    bareErr = e instanceof Error ? e.message : String(e)
  }
  const bareOk = bareErr === null && bareCount === 0
  record(
    "3. bare client (no GUC) → 0 rows",
    bareOk,
    bareErr ? `error: ${bareErr}` : `count=${bareCount}`,
  )

  // Check 4 — A cannot findUnique one of B's cases by id.
  const targetB = bCases[0]
  if (!targetB) {
    record("4. A cross-read of B's case blocked", false, "no B case to target (check 2 likely failed)")
  } else {
    const leaked = await dbA.case.findUnique({ where: { id: targetB.id } })
    const xOk = leaked === null
    record(
      "4. A cross-read of B's case blocked",
      xOk,
      leaked ? `LEAK: got ${leaked.title}` : `findUnique returned null for ${targetB.title}`,
    )
  }

  console.log("")
  const allPass = checks.every((c) => c.pass)
  console.log(allPass ? "ALL CHECKS PASS" : "FAILURES — RLS NOT SAFE")
  await baseClient.$disconnect()
  process.exit(allPass ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await baseClient.$disconnect()
  process.exit(1)
})
