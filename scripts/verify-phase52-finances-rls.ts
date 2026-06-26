/**
 * Phase 5.2a action-layer RLS proof — Payment cross-user isolation.
 *
 * Simulates the Prisma query patterns used by financeActions:
 *   - SELECT scope: scoped findMany only returns the caller's Payments
 *   - cross-user reads: scoped findUnique on another user's payment id → null
 *   - cross-user writes: scoped updateMany / deleteMany count=0
 *   - INSERT with mismatched userId → blocked by WITH CHECK
 *
 * Two seeded users (per `npx prisma db seed`):
 *   USER_A_EMAIL = jainsahil2897@gmail.com  (A-Case-1, A-Case-2 seeded)
 *   USER_B_EMAIL = userb@test.local         (B-Case-1, B-Case-2 seeded)
 *
 * Self-seed (Payment is not in prisma/seed.ts):
 *   - Create one probe Payment per user under that user's scoped client.
 *   - Track ids in a module-level array; cleanup deleteMany by id under
 *     each owner's scope (lawdger_app + FORCE RLS sees zero rows without
 *     a set GUC, so cleanup MUST scope to the owner).
 *
 * Idempotent + bail-safe:
 *   - Probe ids captured at create time; cleanup runs in finally even on
 *     mid-run failure. No stable string field on Payment, so cleanup is
 *     id-list-based (not prefix sweep like phase4 / pillar-b).
 *
 * Run via `smoke:rls-runtime` orchestrator (added to
 * scripts/check-rls-runtime.ts VERIFY_SCRIPTS).
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — any check failed or unexpected error
 *   2 — precondition not met (seed users / cases missing)
 */

import { getPrismaForUser } from "../src/lib/prisma-rls"
import { prisma as baseClient } from "../src/lib/prisma"

const USER_A_EMAIL = "jainsahil2897@gmail.com"
const USER_B_EMAIL = "userb@test.local"

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []

// Track probe ids per owner for owner-scoped cleanup. Without GUC,
// lawdger_app sees zero rows, so cleanup MUST run via the owner's
// scoped client — baseClient cannot reach these rows.
let cleanupUserAId: string | null = null
let cleanupUserBId: string | null = null
const probeIdsByOwner: { a: string[]; b: string[] } = { a: [], b: [] }

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`)
}

async function cleanupProbes() {
  if (cleanupUserAId && probeIdsByOwner.a.length > 0) {
    const dbA = getPrismaForUser(cleanupUserAId)
    await dbA.payment.deleteMany({ where: { id: { in: probeIdsByOwner.a } } })
  }
  if (cleanupUserBId && probeIdsByOwner.b.length > 0) {
    const dbB = getPrismaForUser(cleanupUserBId)
    await dbB.payment.deleteMany({ where: { id: { in: probeIdsByOwner.b } } })
  }
}

async function main(): Promise<number> {
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
    console.error(
      `Seed users missing — got A=${!!userA} B=${!!userB}. ` +
        "Run `npx dotenv -e .env.local -- npx prisma db seed` first.",
    )
    return 2
  }

  cleanupUserAId = userA.id
  cleanupUserBId = userB.id

  const dbA = getPrismaForUser(userA.id)
  const dbB = getPrismaForUser(userB.id)

  const aCases = await dbA.case.findMany({ select: { id: true, title: true } })
  const bCases = await dbB.case.findMany({ select: { id: true, title: true } })
  const aCase = aCases[0]
  const bCase = bCases[0]
  if (!aCase || !bCase) {
    console.error(
      `Seed cases missing — A=${aCases.length} B=${bCases.length}. Re-seed.`,
    )
    return 2
  }

  // ─── Self-seed: one Payment per user, owner-scoped create ────────────────
  const aPayment = await dbA.payment.create({
    data: {
      userId: userA.id,
      caseId: aCase.id,
      amount: 1000,
      status: "pending",
    },
    select: { id: true },
  })
  probeIdsByOwner.a.push(aPayment.id)

  const bPayment = await dbB.payment.create({
    data: {
      userId: userB.id,
      caseId: bCase.id,
      amount: 2000,
      status: "pending",
    },
    select: { id: true },
  })
  probeIdsByOwner.b.push(bPayment.id)

  console.log(
    `\nProbe Payments — A: id=${aPayment.id} case="${aCase.title}"  ` +
      `B: id=${bPayment.id} case="${bCase.title}"\n`,
  )

  // ─── Check 1: SELECT isolation — scoped(A) findMany excludes B's rows ────
  // Mirrors getFinancesData's per-user payment surface. Every row must
  // belong to userA; B's probe must not appear.
  const aListing = await dbA.payment.findMany({ select: { id: true, userId: true } })
  const allOwnedByA = aListing.every((p) => p.userId === userA.id)
  const bLeaked = aListing.some((p) => p.id === bPayment.id)
  record(
    "1. SELECT isolation: scoped(A) findMany returns only A's payments",
    allOwnedByA && !bLeaked && aListing.length > 0,
    `count=${aListing.length} allOwnedByA=${allOwnedByA} bLeaked=${bLeaked}`,
  )

  // ─── Check 2: cross-user SELECT fail-closed — findUnique on B's id → null
  // RLS silently filters; the unique-id lookup must not leak B's row to A.
  const bByA = await dbA.payment.findUnique({
    where: { id: bPayment.id },
    select: { id: true },
  })
  record(
    "2. cross-user SELECT fail-closed: scoped(A) findUnique on B's paymentId → null",
    bByA === null,
    bByA ? `LEAK: ${JSON.stringify(bByA)}` : "returned null — RLS silently filtered",
  )

  // ─── Check 3: cross-user UPDATE fail-closed — updateMany count=0 ─────────
  // Mirror phase4 shape: updateMany on B's id under A's scope must return
  // count=0 and B's row must remain unchanged when re-read under B's scope.
  const aUpdate = await dbA.payment.updateMany({
    where: { id: bPayment.id, userId: userA.id },
    data: { amount: 999 },
  })
  const bPostUpdate = await dbB.payment.findUnique({
    where: { id: bPayment.id },
    select: { amount: true },
  })
  const amountIntact = bPostUpdate?.amount === 2000
  record(
    "3. cross-user UPDATE fail-closed: scoped(A) updateMany on B's payment → count=0; B's amount intact",
    aUpdate.count === 0 && amountIntact,
    `count=${aUpdate.count}, B.amount=${bPostUpdate?.amount}`,
  )

  // ─── Check 4: cross-user DELETE fail-closed — deleteMany count=0 ─────────
  // Mirror phase4 shape: deleteMany on B's id under A's scope returns
  // count=0; B's row must still exist when re-read under B's scope.
  const aDelete = await dbA.payment.deleteMany({
    where: { id: bPayment.id, userId: userA.id },
  })
  const bPostDelete = await dbB.payment.findUnique({
    where: { id: bPayment.id },
    select: { id: true },
  })
  record(
    "4. cross-user DELETE fail-closed: scoped(A) deleteMany on B's payment → count=0; B's row persists",
    aDelete.count === 0 && bPostDelete !== null,
    `count=${aDelete.count}, B.row=${bPostDelete !== null ? "present" : "MISSING"}`,
  )

  // ─── Check 5: INSERT with mismatched userId fail-closed ──────────────────
  // Under A's scope, attempt to create a Payment with userId=B.id on A's
  // own case. The RLS WITH CHECK clause must reject (Prisma throws). We
  // do not need to capture the id — the create must not succeed.
  let insertThrew = false
  let insertErrMsg = ""
  try {
    await dbA.payment.create({
      data: {
        userId: userB.id,
        caseId: aCase.id,
        amount: 1,
        status: "pending",
      },
      select: { id: true },
    })
  } catch (e) {
    insertThrew = true
    insertErrMsg = e instanceof Error ? e.message.split("\n")[0] : String(e)
  }
  record(
    "5. INSERT with mismatched userId: scoped(A) create with userId=B.id → blocked by WITH CHECK",
    insertThrew,
    insertThrew ? `threw as expected: ${insertErrMsg}` : "LEAK: create succeeded with wrong userId",
  )

  console.log("")
  const allPass = checks.every((c) => c.pass)
  console.log(allPass ? "ALL PHASE-5.2a PAYMENT RLS CHECKS PASS" : "FAILURES — Payment RLS NOT SAFE")
  return allPass ? 0 : 1
}

main()
  .then(async (code) => {
    await cleanupProbes().catch((e) => {
      console.error("cleanup error:", e)
    })
    await baseClient.$disconnect()
    process.exit(code)
  })
  .catch(async (e) => {
    console.error(e)
    await cleanupProbes().catch(() => {})
    await baseClient.$disconnect()
    process.exit(1)
  })
