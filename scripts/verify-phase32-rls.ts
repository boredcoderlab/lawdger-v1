/**
 * Phase 3.2 action-layer RLS proof.
 *
 * Simulates the exact Prisma query patterns used by the new caseActions:
 *   - getCase / getCaseWithChildren: scoped findFirst with where:{id, userId}
 *   - updateCase / updateCaseStatus:  scoped findFirst owner-check, then update
 *
 * Two test users (seeded by `npx prisma db seed`):
 *   USER_A_EMAIL = jainsahil2897@gmail.com  (has 2 A-prefixed cases)
 *   USER_B_EMAIL = userB@test.local         (has 2 B-prefixed cases)
 *
 * Each check exercises userB's scoped client trying to touch userA's case.
 * All must PASS — proves RLS + defence-in-depth combined catch cross-tenant
 * access via the exact query shapes used by caseActions.ts.
 *
 * Run:
 *   npx dotenv -e .env.local -- npx tsx scripts/verify-phase32-rls.ts
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

  // Get a userA-scoped case id to target.
  const dbA = getPrismaForUser(userA.id)
  const aCases = await dbA.case.findMany({ select: { id: true, title: true } })
  const targetA = aCases[0]
  if (!targetA) {
    throw new Error("userA has no cases — re-seed first.")
  }
  console.log(`\nTargeting userA case id=${targetA.id} title="${targetA.title}"\n`)

  const dbB = getPrismaForUser(userB.id)

  // ─── Check 1: getCase pattern — findFirst where:{id, userId:B} on A's case ───
  // Simulates getCase(targetA.id) called by userB.
  const found = await dbB.case.findFirst({
    where: { id: targetA.id, userId: userB.id },
  })
  record(
    "1. getCase pattern: scoped(B) findFirst on A's caseId → null",
    found === null,
    found ? `LEAK: returned ${found.title}` : "returned null as expected",
  )

  // ─── Check 2: getCaseWithChildren pattern — same, with include ───
  const foundDeep = await dbB.case.findFirst({
    where: { id: targetA.id, userId: userB.id },
    include: {
      tasks: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      calendarEvents: { orderBy: { hearingDate: "asc" } },
    },
  })
  record(
    "2. getCaseWithChildren pattern: scoped(B) findFirst+include → null",
    foundDeep === null,
    foundDeep ? `LEAK: returned ${foundDeep.title}` : "returned null as expected",
  )

  // ─── Check 3: updateCase owner-check — findFirst returns null → action exits ───
  // Simulates the first step inside updateCase().
  const ownerCheck = await dbB.case.findFirst({
    where: { id: targetA.id, userId: userB.id },
    select: { id: true },
  })
  record(
    "3. updateCase owner-check: scoped(B) findFirst select-id → null",
    ownerCheck === null,
    ownerCheck ? `LEAK: ${JSON.stringify(ownerCheck)}` : "returned null — action would short-circuit with {ok:false}",
  )

  // ─── Check 4: updateCaseStatus owner-check — same shape ───
  const statusOwnerCheck = await dbB.case.findFirst({
    where: { id: targetA.id, userId: userB.id },
    select: { id: true },
  })
  record(
    "4. updateCaseStatus owner-check: scoped(B) findFirst → null",
    statusOwnerCheck === null,
    statusOwnerCheck ? "LEAK" : "returned null — action would short-circuit",
  )

  // ─── Check 5: deleteMany defence-in-depth — count=0 on A's id under B ───
  // Simulates deleteCase final step.
  const delResult = await dbB.case.deleteMany({
    where: { id: targetA.id, userId: userB.id },
  })
  record(
    "5. deleteCase pattern: scoped(B) deleteMany on A's caseId → count=0",
    delResult.count === 0,
    `count=${delResult.count}`,
  )

  // ─── Check 6: confirm A's case still exists post-attack ───
  const stillThere = await dbA.case.findFirst({ where: { id: targetA.id } })
  record(
    "6. A's case survives the attempted attack",
    stillThere !== null,
    stillThere ? `still present: ${stillThere.title}` : "MISSING — case was deleted!",
  )

  // ─── Check 7: updateCaseAgreedFee cross-user mutation fail-closed ───
  // Mirrors updateCaseAgreedFee's guard exactly:
  //   scoped.case.updateMany({ where: { id, userId }, data: { agreedFee } })
  //   → count===0 returns fail("not_found").
  // Distinct from the owner-chain precheck used by updateCase (checks 3/4):
  // there is NO separate findFirst here — the updateMany's own count is the
  // guard. Under userB's GUC A's case row is invisible (FORCE RLS) and the
  // userId filter mismatches, so zero rows match → count=0, fail-closed.
  // Snapshot the seeded agreedFee first so check 8 can prove non-mutation.
  const seededFee =
    (
      await dbA.case.findFirst({
        where: { id: targetA.id },
        select: { agreedFee: true },
      })
    )?.agreedFee ?? null
  const bFeeUpdate = await dbB.case.updateMany({
    where: { id: targetA.id, userId: userB.id },
    data: { agreedFee: 999999 },
  })
  record(
    "7. updateCaseAgreedFee fail-closed: scoped(B) updateMany on A's case → count=0",
    bFeeUpdate.count === 0,
    `count=${bFeeUpdate.count} — updateMany count guard blocks (no owner-chain precheck; RLS + userId filter yield 0 rows)`,
  )

  // ─── Check 8: updateCaseAgreedFee survival ───
  // A's re-read must show the seeded agreedFee untouched by B's attack.
  const feeSurvivor =
    (
      await dbA.case.findFirst({
        where: { id: targetA.id },
        select: { agreedFee: true },
      })
    )?.agreedFee ?? null
  record(
    "8. updateCaseAgreedFee survival: A's re-read confirms agreedFee unchanged from seed value",
    feeSurvivor === seededFee,
    `seeded=${seededFee}, post-attack=${feeSurvivor} — ${feeSurvivor === seededFee ? "unchanged" : "MUTATED"}`,
  )

  // ─── Check 9: deleteCase cross-tenant Document isolation (closes N59) ────
  // Simulates a cross-tenant deleteCase-shaped attack directly against RLS
  // (no userId filter in the where-clause — this tests the FORCE RLS
  // boundary itself, not the app-level userId defence-in-depth exercised by
  // checks 1-8). Confirms userB can neither delete userA's Case nor orphan
  // userA's Document via the caseId path. Structural-only per N40.
  const PROBE_CASE_TITLE = "[verify-phase32] N59 probe case"
  const PROBE_DOC_FILENAME = "[verify-phase32] N59 probe doc"

  // Idempotent bail-safe: sweep any leftover probe rows from a prior failed run.
  await dbA.document.deleteMany({ where: { filename: PROBE_DOC_FILENAME } })
  await dbA.case.deleteMany({ where: { title: PROBE_CASE_TITLE } })

  const probeCase = await dbA.case.create({
    data: { userId: userA.id, title: PROBE_CASE_TITLE },
    select: { id: true },
  })
  const probeDoc = await dbA.document.create({
    data: { userId: userA.id, caseId: probeCase.id, filename: PROBE_DOC_FILENAME },
    select: { id: true },
  })

  try {
    let bCaseDeleteCount: number | null = null
    let bCaseDeleteThrew = false
    try {
      const r = await dbB.case.deleteMany({ where: { id: probeCase.id } })
      bCaseDeleteCount = r.count
    } catch {
      bCaseDeleteThrew = true
    }

    let bDocDeleteCount: number | null = null
    let bDocDeleteThrew = false
    try {
      const r = await dbB.document.deleteMany({ where: { caseId: probeCase.id } })
      bDocDeleteCount = r.count
    } catch {
      bDocDeleteThrew = true
    }

    const caseSurvivor = await dbA.case.findFirst({ where: { id: probeCase.id } })
    const docSurvivor = await dbA.document.findFirst({ where: { id: probeDoc.id } })

    const attackBlocked =
      (bCaseDeleteThrew || bCaseDeleteCount === 0) &&
      (bDocDeleteThrew || bDocDeleteCount === 0)
    const caseIntact = caseSurvivor !== null
    const docIntact = docSurvivor !== null && docSurvivor.caseId === probeCase.id

    record(
      "9. deleteCase cross-tenant Document isolation (closes N59): scoped(B) attack on A's case+document blocked",
      attackBlocked && caseIntact && docIntact,
      `case-delete: ${bCaseDeleteThrew ? "threw" : `count=${bCaseDeleteCount}`}, ` +
        `document-delete: ${bDocDeleteThrew ? "threw" : `count=${bDocDeleteCount}`}, ` +
        `case survives: ${caseIntact}, document survives with caseId intact: ${docIntact}` +
        (docSurvivor ? ` (caseId=${docSurvivor.caseId})` : " (document MISSING)"),
    )
  } finally {
    await dbA.document.deleteMany({ where: { filename: PROBE_DOC_FILENAME } })
    await dbA.case.deleteMany({ where: { title: PROBE_CASE_TITLE } })
  }

  console.log("")
  const allPass = checks.every((c) => c.pass)
  console.log(allPass ? "ALL PHASE-3.2 RLS CHECKS PASS" : "FAILURES — RLS NOT SAFE")
  await baseClient.$disconnect()
  process.exit(allPass ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await baseClient.$disconnect()
  process.exit(1)
})
