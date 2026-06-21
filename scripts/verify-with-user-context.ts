/**
 * withUserContext correctness proof.
 *
 * Validates the Phase 3.2.1 multi-query pattern: the GUC set inside an
 * interactive transaction MUST apply to EVERY subsequent query in the
 * same `tx` callback, not just the first. Also confirms that RLS
 * correctly blocks cross-tenant reads/writes from inside a scoped tx.
 *
 * Run AFTER DATABASE_URL is repointed at the restricted `lawdger_app`
 * role (NOBYPASSRLS):
 *   npx dotenv -e .env.local -- npx tsx scripts/verify-with-user-context.ts
 *
 * Exit codes:
 *   0  all assertions pass
 *   1  assertion(s) failed — withUserContext or RLS not safe
 *   2  precondition not met — test could not run (e.g. missing seed)
 *
 * Assertions (all must PASS):
 *   1. Two sequential reads inside withUserContext(A) both return A's
 *      cases only — proves set_config persisted across queries in the
 *      same interactive tx.
 *   2. findUnique on B's caseId from inside withUserContext(A) returns
 *      null — cross-tenant point-read blocked by RLS under scoped tx.
 *   3. updateMany targeting B's caseId from inside withUserContext(A)
 *      returns count=0 — cross-tenant write blocked by RLS.
 *   4. Re-reading B's case under withUserContext(B) confirms the title
 *      was NOT mutated by the attack — RLS held, the row is intact.
 */

import { prisma as baseClient } from "../src/lib/prisma"
import { withUserContext } from "../src/lib/prisma-rls"

const USER_A_EMAIL = "jainsahil2897@gmail.com"
const USER_B_EMAIL = "userb@test.local"

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`)
}

// Distinct exit codes:
//   2 — precondition not met (test could not run)
//   1 — assertion failed (test ran and found a real problem)
//   0 — all pass
// Synchronous so TypeScript narrows `null` checks correctly through it.
// process.exit terminates and Node closes the pool — no explicit
// disconnect needed on this path.
function abortPrecondition(message: string): never {
  console.error(`\nPRECONDITION FAIL  ${message}`)
  console.error(
    "Test could not run. Exiting with code 2 (distinct from assertion failure).",
  )
  process.exit(2)
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
    abortPrecondition(
      `Seed users missing — got A=${!!userA} B=${!!userB}. Run ` +
        "`npx dotenv -e .env.local -- npx prisma db seed` first.",
    )
  }

  // Confirm runtime role.
  const roleRows = await baseClient.$queryRaw<{ current_user: string }[]>`
    SELECT current_user
  `
  const role = roleRows[0]?.current_user ?? "unknown"
  if (role !== "lawdger_app") {
    console.log(
      `WARN  expected lawdger_app — got ${role}. DATABASE_URL may not be repointed.`,
    )
  }

  // ─── Preflight: print the test surface BEFORE running any assertions ───
  // Read both users' case lists via their own withUserContext, since the
  // bare client is RLS-deny-by-default and can't see anything.
  const aCases = await withUserContext(userA.id, async (tx) => {
    return tx.case.findMany({
      where: { userId: userA.id },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    })
  })
  const bCases = await withUserContext(userB.id, async (tx) => {
    return tx.case.findMany({
      where: { userId: userB.id },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    })
  })

  console.log("\n─── Preflight: test surface ───")
  console.log(`Runtime DB role     : ${role}`)
  console.log(
    `userA  email=${USER_A_EMAIL}  id=${userA.id}  cases=${aCases.length}  ` +
      `titles=[${aCases
        .slice(0, 3)
        .map((c) => c.title)
        .join(", ")}${aCases.length > 3 ? ", …" : ""}]`,
  )
  console.log(
    `userB  email=${USER_B_EMAIL}  id=${userB.id}  cases=${bCases.length}  ` +
      `titles=[${bCases
        .slice(0, 3)
        .map((c) => c.title)
        .join(", ")}${bCases.length > 3 ? ", …" : ""}]`,
  )

  if (aCases.length === 0) {
    abortPrecondition(
      "userA has no cases — re-seed first. Expected the seeded A-prefix " +
        "fixtures from prisma/seed.ts.",
    )
  }
  if (bCases.length === 0) {
    abortPrecondition(
      "userB has no cases — re-seed first. Expected the seeded B-prefix " +
        "fixtures from prisma/seed.ts.",
    )
  }

  // Target: first B case. Capture original title BEFORE any attack so
  // the post-attack re-read comparison can't be spoofed.
  const targetB = bCases[0]!
  const originalTitleB = targetB.title
  console.log(
    `Cross-tenant target : id=${targetB.id}  title="${originalTitleB}"  (owned by userB)`,
  )
  console.log("─────────────────────────────────\n")

  // ─── Run the whole attack inside ONE withUserContext(A) transaction ───
  const tripleAttack = await withUserContext(userA.id, async (tx) => {
    // 1a. First read — A's cases.
    const firstRead = await tx.case.findMany({
      select: { id: true, userId: true, title: true },
    })

    // 1b. Second read — must ALSO be A's cases. Proves GUC persisted
    //     across the first query's execution. If set_config didn't
    //     propagate, this read would return [] (RLS-deny-by-default).
    const secondRead = await tx.case.findMany({
      select: { id: true, userId: true, title: true },
    })

    // 2. Cross-tenant point-read — must return null. RLS filters B's row
    //    out of the result even though we know its id.
    const userBCaseRead = await tx.case.findUnique({
      where: { id: targetB.id },
      select: { id: true, title: true },
    })

    // 3. Cross-tenant write — must update 0 rows. RLS prevents the
    //    write from reaching B's row from inside A's scoped tx.
    const updateAttempt = await tx.case.updateMany({
      where: { id: targetB.id },
      data: { title: "__pwn__" },
    })

    return { firstRead, secondRead, userBCaseRead, updateAttempt }
  })

  // ─── Check 1: both reads inside the same tx scoped to userA ───
  const firstOk =
    tripleAttack.firstRead.length > 0 &&
    tripleAttack.firstRead.every((c) => c.userId === userA.id)
  const secondOk =
    tripleAttack.secondRead.length > 0 &&
    tripleAttack.secondRead.every((c) => c.userId === userA.id)
  const sameLen =
    tripleAttack.firstRead.length === tripleAttack.secondRead.length
  record(
    "1a. withUserContext(A) first read → only A's cases",
    firstOk,
    `count=${tripleAttack.firstRead.length} ` +
      `titles=[${tripleAttack.firstRead.map((c) => c.title).join(", ")}]`,
  )
  record(
    "1b. withUserContext(A) second read → still only A's cases (GUC persisted)",
    secondOk && sameLen,
    `count=${tripleAttack.secondRead.length} ` +
      `titles=[${tripleAttack.secondRead.map((c) => c.title).join(", ")}]`,
  )

  // ─── Check 2: findUnique on B's caseId returns null ───
  record(
    "2. findUnique(B.caseId) from withUserContext(A) → null",
    tripleAttack.userBCaseRead === null,
    tripleAttack.userBCaseRead
      ? `LEAK: returned ${JSON.stringify(tripleAttack.userBCaseRead)}`
      : "returned null as expected",
  )

  // ─── Check 3: updateMany returns count=0 ───
  record(
    "3. updateMany(B.caseId) from withUserContext(A) → count=0",
    tripleAttack.updateAttempt.count === 0,
    `count=${tripleAttack.updateAttempt.count}`,
  )

  // ─── Check 4: B's case title unchanged when re-read under B's scope ───
  const reread = await withUserContext(userB.id, async (tx) => {
    return tx.case.findUnique({
      where: { id: targetB.id },
      select: { id: true, title: true },
    })
  })
  const reread4Ok = reread !== null && reread.title === originalTitleB
  record(
    "4. withUserContext(B) re-read of B's case → title unchanged",
    reread4Ok,
    reread
      ? `title="${reread.title}" (expected "${originalTitleB}")`
      : "row missing — B's case was deleted or hidden",
  )

  console.log("")
  const allPass = checks.every((c) => c.pass)
  console.log(
    allPass
      ? "ALL withUserContext CHECKS PASS"
      : "FAILURES — withUserContext is not safe",
  )
  await baseClient.$disconnect()
  process.exit(allPass ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await baseClient.$disconnect()
  process.exit(1)
})
