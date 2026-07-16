/**
 * Phase 4-A.7 action-layer RLS proof — updateCaseTask cross-user fail-closed
 * across BOTH branches of the N70 broadened owner-check OR-clause.
 *
 * updateCaseTask gates every write behind:
 *   db.task.findFirst({ where: { id, OR: [
 *     { case: { userId: user.id } },      // branch 1: case-linked task
 *     { userId: user.id, caseId: null },  // branch 2: independent task
 *   ] } })
 * then db.task.update({ where: { id } }). This script simulates the
 * cross-tenant attack (userB scope) against both branches and asserts the
 * updateMany count is 0, plus a positive control that A's own update lands.
 *
 * Mirrors `verify-phase4-rls.ts` structure:
 *   - resolves seed users via the `auth_find_user_by_email` RPC
 *   - probes inserted under userA's scoped GUC client
 *   - cross-tenant attacks exercised under userB's scoped GUC client
 *   - cleanup sweeps probe rows under userA's GUC (NOT baseClient — the
 *     lawdger_app role with FORCE RLS sees zero rows without a set GUC)
 *
 * Two seeded users (per `npx prisma db seed`):
 *   USER_A_EMAIL = jainsahil2897@gmail.com  (has A-prefixed case + tasks)
 *   USER_B_EMAIL = userb@test.local         (lowercase per A.4 RPC fix)
 *
 * Idempotent + bail-safe:
 *   - Both probe Tasks share the stable description PROBE_DESCRIPTION so
 *     the cleanup sweep is unambiguous; distinguished by caseId presence.
 *   - Cleanup runs in the .then/.catch tail under userA's GUC.
 *
 * Wired into `smoke:rls-runtime` orchestrator.
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

// Both probe Tasks share this description (distinguished by caseId presence)
// so the cleanup sweep is a single unambiguous deleteMany.
const PROBE_DESCRIPTION = "[verify-phase4-a7] probe task — userA owned"

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []

let cleanupUserAId: string | null = null

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`)
}

async function cleanupProbe() {
  if (!cleanupUserAId) return
  const dbA = getPrismaForUser(cleanupUserAId)
  await dbA.task.deleteMany({
    where: { description: PROBE_DESCRIPTION },
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

  cleanupUserAId = userA.id
  await cleanupProbe()

  const dbA = getPrismaForUser(userA.id)
  const aCases = await dbA.case.findMany({ select: { id: true, title: true } })
  const targetCase = aCases[0]
  if (!targetCase) {
    console.error("userA has no cases — re-seed first.")
    return 2
  }

  const dbB = getPrismaForUser(userB.id)

  // ─── Set up: two probe Tasks under user A ────────────────────────────────
  // caseLinkedProbe exercises OR-branch 1 (case.userId); independentProbe
  // exercises OR-branch 2 (userId + caseId null).
  const caseLinkedProbe = await dbA.task.create({
    data: {
      userId: userA.id,
      caseId: targetCase.id,
      description: PROBE_DESCRIPTION,
      status: "pending",
      isUrgent: false,
    },
    select: { id: true },
  })
  const independentProbe = await dbA.task.create({
    data: {
      userId: userA.id,
      caseId: null,
      description: PROBE_DESCRIPTION,
      status: "pending",
      isUrgent: false,
    },
    select: { id: true },
  })
  console.log(
    `\nCase-linked probe id=${caseLinkedProbe.id} caseId=${targetCase.id} ("${targetCase.title}")` +
      `\nIndependent probe id=${independentProbe.id} caseId=null\n`,
  )

  // ─── Check 1: updateCaseTask fail-closed — case-linked branch ────────────
  // userB runs updateCaseTask's write shape (updateMany + the N70 OR-clause,
  // scoped to userB) against A's case-linked task. OR-branch 1 (case.userId)
  // must not match under B's scope → count=0.
  const bUpdateCaseLinked = await dbB.task.updateMany({
    where: {
      id: caseLinkedProbe.id,
      OR: [{ case: { userId: userB.id } }, { userId: userB.id, caseId: null }],
    },
    data: { description: "[TAMPERED by userB]" },
  })
  record(
    "1. updateCaseTask fail-closed (case-linked branch): scoped(B) updateMany on A's case-linked task → count=0",
    bUpdateCaseLinked.count === 0,
    `count=${bUpdateCaseLinked.count}`,
  )

  // ─── Check 2: updateCaseTask fail-closed — independent branch ────────────
  // Same attack against A's independent (caseId null) task. OR-branch 2
  // (userId + caseId null) must not match under B's scope → count=0.
  const bUpdateIndependent = await dbB.task.updateMany({
    where: {
      id: independentProbe.id,
      OR: [{ case: { userId: userB.id } }, { userId: userB.id, caseId: null }],
    },
    data: { description: "[TAMPERED by userB]" },
  })
  record(
    "2. updateCaseTask fail-closed (independent branch): scoped(B) updateMany on A's null-caseId task → count=0",
    bUpdateIndependent.count === 0,
    `count=${bUpdateIndependent.count}`,
  )

  // ─── Check 3: positive control + survival ────────────────────────────────
  // A runs the same updateCaseTask write shape (OR-clause scoped to userA)
  // against its own case-linked task, flipping isUrgent → true. Then A
  // re-reads both probes: the case-linked update must have landed AND
  // neither description may show B's tamper string.
  const aUpdate = await dbA.task.updateMany({
    where: {
      id: caseLinkedProbe.id,
      OR: [{ case: { userId: userA.id } }, { userId: userA.id, caseId: null }],
    },
    data: { isUrgent: true },
  })
  const aCaseLinked = await dbA.task.findFirst({
    where: { id: caseLinkedProbe.id },
    select: { id: true, isUrgent: true, description: true },
  })
  const aIndependent = await dbA.task.findFirst({
    where: { id: independentProbe.id },
    select: { id: true, description: true },
  })
  const ownUpdateLanded = aUpdate.count === 1 && aCaseLinked?.isUrgent === true
  const neitherCorrupted =
    aCaseLinked?.description === PROBE_DESCRIPTION &&
    aIndependent?.description === PROBE_DESCRIPTION
  record(
    "3. updateCaseTask positive control + survival: A's own update lands AND neither probe corrupted by B",
    ownUpdateLanded && neitherCorrupted,
    `A update count=${aUpdate.count}, isUrgent=${aCaseLinked?.isUrgent}, ` +
      `case-linked desc ${aCaseLinked?.description === PROBE_DESCRIPTION ? "intact" : "TAMPERED"}, ` +
      `independent desc ${aIndependent?.description === PROBE_DESCRIPTION ? "intact" : "TAMPERED"}`,
  )

  console.log("")
  const allPass = checks.every((c) => c.pass)
  console.log(
    allPass ? "ALL PHASE-4 A.7 updateCaseTask RLS CHECKS PASS" : "FAILURES — updateCaseTask RLS NOT SAFE",
  )
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
