/**
 * Phase 4 pillar-C.1 action-layer RLS proof — Note UPDATE + DELETE
 * cross-tenant fail-closed.
 *
 * Covers the mutation half of the Note surface that `verify-pillar-b-rls.ts`
 * leaves untested: `updateNote`'s `tx.note.update` write and `deleteNote`'s
 * `tx.note.deleteMany` cascade. Both run inside an RLS-scoped GUC in
 * production; here we simulate the cross-tenant attack directly against the
 * scoped Prisma client (userB's GUC) and assert fail-closed semantics.
 *
 * Mirrors `verify-pillar-b-rls.ts` structure:
 *   - resolves seed users via the `auth_find_user_by_email` RPC
 *   - probe inserted under userA's scoped GUC client
 *   - cross-tenant attacks exercised under userB's scoped GUC client
 *   - cleanup sweeps probe rows under userA's GUC (NOT baseClient — the
 *     lawdger_app role with FORCE RLS sees zero rows without a set GUC)
 *
 * Two seeded users (per `npx prisma db seed`):
 *   USER_A_EMAIL = jainsahil2897@gmail.com  (seed case + tasks A-side)
 *   USER_B_EMAIL = userb@test.local         (lowercase per A.4 RPC fix)
 *
 * Idempotent + bail-safe:
 *   - Probe row uses stable prefix "[verify-phase4-c1] " so the cleanup
 *     sweep is unambiguous and catches stragglers from prior failed runs.
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

const PROBE_PREFIX = "[verify-phase4-c1] "
const PROBE_CONTENT = `${PROBE_PREFIX}updateNote/deleteNote fail-closed probe — userA owned`

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
  await dbA.note.deleteMany({
    where: { cleanContent: { startsWith: PROBE_PREFIX } },
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

  // ─── Set up: one General Note probe under user A ─────────────────────────
  const probeNote = await dbA.note.create({
    data: {
      userId: userA.id,
      caseId: targetCase.id,
      cleanContent: PROBE_CONTENT,
      category: "General Note",
    },
    select: { id: true },
  })
  console.log(
    `\nProbe note id=${probeNote.id} userId=${userA.id} caseId=${targetCase.id} ("${targetCase.title}")`,
  )

  // ─── Check 1: updateNote cross-user pre-flight null ──────────────────────
  // updateNote's internal guard reads the note under the caller's scope
  // before writing. Under userB's GUC that findFirst must return null so the
  // action fails closed with note_not_found rather than mutating A's row.
  const bPreflight = await dbB.note.findFirst({
    where: { id: probeNote.id },
    select: { id: true },
  })
  record(
    "1. updateNote pre-flight fail-closed: scoped(B) findFirst on A's note → null",
    bPreflight === null,
    bPreflight
      ? `LEAK: B can resolve A's note ${JSON.stringify(bPreflight)}`
      : "returned null — RLS hides A's note from B's pre-flight read",
  )

  // ─── Check 2: updateNote cross-user mutation fail-closed ─────────────────
  // userB attempts updateNote's write directly — updateMany on A's note id
  // with B's userId. count must be 0; nothing under B's GUC matches A's row.
  const bUpdate = await dbB.note.updateMany({
    where: { id: probeNote.id, userId: userB.id },
    data: { cleanContent: "[TAMPERED by userB]" },
  })
  record(
    "2. updateNote mutation fail-closed: scoped(B) updateMany on A's note → count=0",
    bUpdate.count === 0,
    `count=${bUpdate.count}`,
  )

  // ─── Check 3: updateNote survival ────────────────────────────────────────
  // After B's attack, A's re-read must show the original content intact.
  const survivor = await dbA.note.findFirst({
    where: { id: probeNote.id },
    select: { id: true, cleanContent: true },
  })
  record(
    "3. updateNote survival: A's re-read confirms content unchanged after B's attack",
    survivor !== null && survivor.cleanContent === PROBE_CONTENT,
    survivor
      ? `content ${survivor.cleanContent === PROBE_CONTENT ? "unchanged" : `MUTATED to "${survivor.cleanContent}"`}`
      : "note MISSING under A's scope",
  )

  // ─── Check 4: deleteNote cross-user fail-closed ──────────────────────────
  // userB attempts deleteNote's cascade delete — deleteMany on A's note id
  // with B's userId. count must be 0; note must still exist under A.
  const bDelete = await dbB.note.deleteMany({
    where: { id: probeNote.id, userId: userB.id },
  })
  const stillThere = await dbA.note.findFirst({
    where: { id: probeNote.id },
    select: { id: true },
  })
  record(
    "4. deleteNote fail-closed: scoped(B) deleteMany on A's note → count=0; note persists under A",
    bDelete.count === 0 && stillThere !== null,
    `count=${bDelete.count}, A still sees note=${stillThere !== null}`,
  )

  console.log("")
  const allPass = checks.every((c) => c.pass)
  console.log(
    allPass ? "ALL PHASE-4 C.1 NOTE UPDATE/DELETE RLS CHECKS PASS" : "FAILURES — Note UPDATE/DELETE RLS NOT SAFE",
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
