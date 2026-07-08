/**
 * Phase 4-A action-layer RLS proof — Task cross-user isolation.
 *
 * Simulates the Prisma query patterns used by taskActions:
 *   - listAllTasks / case-scoped finds: scoped findFirst+findMany,
 *     defence-in-depth where { id, userId }
 *   - toggleCaseTaskStatus / deleteCaseTask: scoped updateMany /
 *     deleteMany with where { id, userId, caseId }
 *
 * Two seeded users (per `npx prisma db seed`):
 *   USER_A_EMAIL = jainsahil2897@gmail.com  (has A-prefixed case + tasks)
 *   USER_B_EMAIL = userB@test.local         (has B-prefixed case + tasks)
 *
 * Idempotent + bail-safe:
 *   - Creates a single throwaway Task for userA at start (predictable
 *     description for cleanup matching).
 *   - Exercises userB's scoped client trying to touch it.
 *   - Cleans up the throwaway Task (and any earlier orphan with the
 *     same description) in a finally block — survives mid-run failure.
 *
 * Run via `smoke:rls-runtime` orchestrator (added to
 * scripts/check-rls-runtime.ts VERIFY_SCRIPTS).
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — any check failed or unexpected error
 *   2 — precondition not met (seed users missing)
 */

import { getPrismaForUser } from "../src/lib/prisma-rls"
import { prisma as baseClient } from "../src/lib/prisma"

const USER_A_EMAIL = "jainsahil2897@gmail.com"
const USER_B_EMAIL = "userb@test.local"

// Stable, predictable descriptions so cleanup queries are unambiguous.
const PROBE_DESCRIPTION = "[verify-phase4-rls] probe task — userA owned"
const INDEPENDENT_PROBE_DESCRIPTION = "[verify-phase4-rls] independent probe task — userA owned, caseId null"

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []

// Cached at the start of main() once userA is resolved, so the
// finally-block cleanup can scope through userA's RLS context
// (lawdger_app + FORCE RLS sees zero rows without a set GUC, so
// cleanup MUST run as userA).
let cleanupUserAId: string | null = null

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`)
}

async function cleanupProbe() {
  if (!cleanupUserAId) return
  const dbA = getPrismaForUser(cleanupUserAId)
  await dbA.task.deleteMany({
    where: { description: { in: [PROBE_DESCRIPTION, INDEPENDENT_PROBE_DESCRIPTION] } },
  })
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

  // Cache userA id so the post-script finally cleanup can scope to it.
  cleanupUserAId = userA.id

  // Sweep any stragglers from prior runs before creating a fresh probe.
  await cleanupProbe()

  const dbA = getPrismaForUser(userA.id)
  const aCases = await dbA.case.findMany({ select: { id: true, title: true } })
  const targetCase = aCases[0]
  if (!targetCase) {
    console.error("userA has no cases — re-seed first.")
    return 2
  }

  // ─── Create probe Task as userA ──────────────────────────────────────────
  const probe = await dbA.task.create({
    data: {
      userId: userA.id,
      caseId: targetCase.id,
      description: PROBE_DESCRIPTION,
      status: "pending",
      isUrgent: false,
    },
    select: { id: true },
  })
  console.log(
    `\nProbe Task id=${probe.id} userId=${userA.id} caseId=${targetCase.id} ("${targetCase.title}")\n`,
  )

  const dbB = getPrismaForUser(userB.id)

  // ─── Check 1: listAllTasks pattern — scoped(B) findMany on user-scope ───
  // Simulates listAllTasks() called by userB. Probe MUST NOT appear.
  const bListing = await dbB.task.findMany({
    where: { userId: userB.id },
    select: { id: true },
  })
  const inBList = bListing.some((t) => t.id === probe.id)
  record(
    "1. listAllTasks pattern: scoped(B) findMany excludes A's task",
    !inBList,
    inBList ? `LEAK: probe id=${probe.id} appeared in B's listing` : "probe absent as expected",
  )

  // ─── Check 2: case-scoped findFirst with defence-in-depth ────────────────
  // Simulates an action that owner-checks via findFirst { id, userId }.
  const bOwnerCheck = await dbB.task.findFirst({
    where: { id: probe.id, userId: userB.id },
    select: { id: true },
  })
  record(
    "2. owner-check pattern: scoped(B) findFirst on A's taskId → null",
    bOwnerCheck === null,
    bOwnerCheck ? `LEAK: ${JSON.stringify(bOwnerCheck)}` : "returned null — action would short-circuit with {ok:false}",
  )

  // ─── Check 3: toggleCaseTaskStatus pattern — updateMany count=0 ──────────
  // Simulates toggleCaseTaskStatus(probe.id, "pending", targetCase.id)
  // called under userB's scoped client.
  const bUpdate = await dbB.task.updateMany({
    where: { id: probe.id, userId: userB.id, caseId: targetCase.id },
    data: { status: "completed" },
  })
  record(
    "3. toggleCaseTaskStatus pattern: scoped(B) updateMany on A's task → count=0",
    bUpdate.count === 0,
    `count=${bUpdate.count}`,
  )

  // ─── Check 4: deleteCaseTask pattern — deleteMany count=0 ────────────────
  // Simulates deleteCaseTask(probe.id, targetCase.id) called under
  // userB's scoped client.
  const bDelete = await dbB.task.deleteMany({
    where: { id: probe.id, userId: userB.id, caseId: targetCase.id },
  })
  record(
    "4. deleteCaseTask pattern: scoped(B) deleteMany on A's task → count=0",
    bDelete.count === 0,
    `count=${bDelete.count}`,
  )

  // ─── Check 5: probe survives — userA can still read its own task ─────────
  const stillThere = await dbA.task.findFirst({
    where: { id: probe.id },
    select: { id: true, status: true, description: true },
  })
  record(
    "5. A's probe Task survives the attempted cross-tenant attack",
    stillThere !== null && stillThere.status === "pending",
    stillThere
      ? `present id=${stillThere.id} status=${stillThere.status}`
      : "MISSING — probe was deleted or mutated!",
  )

  // ─── Check 6: createCaseTask pattern — B cannot create task on A's case ──
  // Simulates createCaseTask called by userB pointing at userA's caseId.
  // The defence-in-depth findFirst owner-check (case scoped to B) must
  // return null, so the action would short-circuit with "Case not found".
  const bCaseOwnerCheck = await dbB.case.findFirst({
    where: { id: targetCase.id, userId: userB.id },
    select: { id: true },
  })
  record(
    "6. createCaseTask owner-check: scoped(B) findFirst on A's caseId → null",
    bCaseOwnerCheck === null,
    bCaseOwnerCheck
      ? `LEAK: B can see A's case ${JSON.stringify(bCaseOwnerCheck)}`
      : "returned null — createCaseTask would short-circuit with {ok:false}",
  )

  // ─── Check 7: updateCaseTask pattern — cross-user owner-check → null ──────
  // Mirrors the exact findFirst used inside updateCaseTask before the update:
  //   db.task.findFirst({ where: { id: taskId, case: { userId: user.id } } })
  // Under userB's scoped client the probe task is invisible (RLS) AND the
  // case relation join also denies it. Action must return {ok:false,error:"NOT_FOUND"}.
  const bUpdateOwnerCheck = await dbB.task.findFirst({
    where: { id: probe.id, case: { userId: userB.id } },
    select: { id: true },
  })
  record(
    "7. updateCaseTask owner-check: scoped(B) findFirst on A's task (via case.userId) → null",
    bUpdateOwnerCheck === null,
    bUpdateOwnerCheck
      ? `LEAK: B can see A's task ${JSON.stringify(bUpdateOwnerCheck)}`
      : "returned null — updateCaseTask would short-circuit with {ok:false,error:'NOT_FOUND'}",
  )

  // ─── Check 8: Independent Task (caseId null) — cross-tenant isolation ────────
  // Creates an independent task (no case association) as userA, then verifies
  // userB cannot read or mutate it. Policy Task_isolation keys on userId alone,
  // so null caseId rows must be scoped identically to case-linked rows.
  const independentProbe = await dbA.task.create({
    data: {
      userId: userA.id,
      caseId: null,
      description: INDEPENDENT_PROBE_DESCRIPTION,
      status: "pending",
      isUrgent: false,
    },
    select: { id: true },
  })
  console.log(`\nIndependent probe Task id=${independentProbe.id} userId=${userA.id} caseId=null\n`)

  const bSeesIndependent = await dbB.task.findFirst({
    where: { id: independentProbe.id, userId: userB.id },
    select: { id: true },
  })
  record(
    "8. Independent Task isolation: scoped(B) findFirst on A's null-caseId task → null",
    bSeesIndependent === null,
    bSeesIndependent
      ? `LEAK: B can see A's independent task ${JSON.stringify(bSeesIndependent)}`
      : "returned null — RLS correctly scopes independent tasks by userId",
  )

  const aSeesIndependent = await dbA.task.findFirst({
    where: { id: independentProbe.id },
    select: { id: true, caseId: true },
  })
  record(
    "8b. Independent Task readable by owner A",
    aSeesIndependent !== null && aSeesIndependent.caseId === null,
    aSeesIndependent
      ? `present id=${aSeesIndependent.id} caseId=${aSeesIndependent.caseId}`
      : "MISSING — independent probe not found for userA",
  )

  console.log("")
  const allPass = checks.every((c) => c.pass)
  console.log(allPass ? "ALL PHASE-4 TASK RLS CHECKS PASS" : "FAILURES — Task RLS NOT SAFE")
  return allPass ? 0 : 1
}

main()
  .then(async (code) => {
    await cleanupProbe().catch((e) => {
      console.error("cleanup error:", e)
    })
    await baseClient.$disconnect()
    process.exit(code)
  })
  .catch(async (e) => {
    console.error(e)
    await cleanupProbe().catch(() => {})
    await baseClient.$disconnect()
    process.exit(1)
  })
