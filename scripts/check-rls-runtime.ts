/**
 * smoke:rls-runtime — runtime RLS verification wrapper.
 *
 * Detects the current DB role and behaves accordingly:
 *
 *   - If current_user !== 'lawdger_app':
 *       ⚠️  ADVISORY mode. Print a loud notice, exit 0.
 *       Pre-3.0.1d posture — DATABASE_URL still on postgres (BYPASSRLS).
 *       Runtime RLS cannot be meaningfully tested as superuser.
 *
 *   - If current_user === 'lawdger_app':
 *       BLOCKING mode. Run the nine verify scripts in sequence as
 *       child processes (matches the existing smoke:rls invocation
 *       pattern for check-rls.ts). Propagate non-zero exit codes.
 *       Aggregates each child's PASS/FAIL lines and prints a TOTAL
 *       (N65 — the pre-W8 harness ran stdio:"inherit" and never counted).
 *
 * Child scripts spawned (sequentially, never parallel) — each exits
 * 0 pass, 1 fail, 2 precondition (missing seed). Kept in sync with the
 * VERIFY_SCRIPTS array below:
 *   1. scripts/verify-isolation.ts
 *   2. scripts/verify-phase32-rls.ts
 *   3. scripts/verify-with-user-context.ts
 *   4. scripts/verify-phase4-rls.ts
 *   5. scripts/verify-pillar-b-rls.ts
 *   6. scripts/verify-phase52-finances-rls.ts
 *   7. scripts/verify-user-rls.ts
 *   8. scripts/verify-phase4-c1-update-rls.ts
 *   9. scripts/verify-phase4-a7-update-task-rls.ts
 *
 * Wrapper exit codes:
 *   0  — advisory skip (pre-cutover) OR all three children passed
 *   1  — any child reported failure or precondition issue
 *
 * Wired into `npm run smoke` after smoke:rls. Advisory pre-cutover,
 * blocking post-cutover — no env flag needed.
 */

import { spawnSync } from "node:child_process";
import { prisma } from "../src/lib/prisma";

const VERIFY_SCRIPTS = [
  "scripts/verify-isolation.ts",
  "scripts/verify-phase32-rls.ts",
  "scripts/verify-with-user-context.ts",
  "scripts/verify-phase4-rls.ts",
  "scripts/verify-pillar-b-rls.ts",
  "scripts/verify-phase52-finances-rls.ts",
  "scripts/verify-user-rls.ts",
  "scripts/verify-phase4-c1-update-rls.ts",
  "scripts/verify-phase4-a7-update-task-rls.ts",
];

async function detectRole(): Promise<string> {
  const rows = await prisma.$queryRaw<{ current_user: string }[]>`SELECT current_user`;
  return rows[0]?.current_user ?? "unknown";
}

function runChild(script: string): { code: number; assertionCount: number } {
  console.log(`\n──── running ${script} ────`);
  const result = spawnSync("npx", ["tsx", script], {
    // stdout piped (was "inherit") so we can aggregate the child's PASS/FAIL
    // lines — the pre-N65 harness never counted anything. stdin + stderr stay
    // inherited so prompts/errors still stream in OS real-time.
    stdio: ["inherit", "pipe", "inherit"],
    cwd: process.cwd(),
    env: process.env,
  });
  const output = result.stdout?.toString() ?? "";
  // Re-emit the captured stdout verbatim so the visible console shape stays
  // byte-identical to the old streaming view — the only behavioural delta is
  // flush timing (child stdout now flushes on exit, not OS real-time).
  process.stdout.write(output);
  // Count against the shared record() helper's uniform "PASS "/"FAIL " prefix.
  const assertionCount = (output.match(/^(PASS|FAIL)\s/gm) ?? []).length;
  return { code: result.status ?? 1, assertionCount };
}

async function main(): Promise<void> {
  const role = await detectRole();

  if (role !== "lawdger_app") {
    console.log(
      `⚠️  [smoke:rls-runtime] ADVISORY: not connected as lawdger_app ` +
        `(current_user=${role}) — skipping runtime RLS checks.`,
    );
    console.log(
      "    Pre-3.0.1d posture: DATABASE_URL still on postgres (BYPASSRLS). " +
        "Runtime enforcement cannot be tested as superuser.",
    );
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`✅ [smoke:rls-runtime] connected as lawdger_app — running blocking checks`);
  await prisma.$disconnect();

  let anyFail = false;
  let totalAssertions = 0;
  for (const script of VERIFY_SCRIPTS) {
    const { code, assertionCount } = runChild(script);
    totalAssertions += assertionCount;
    if (code === 0) continue;
    anyFail = true;
    if (code === 2) {
      console.error(
        `❌ [smoke:rls-runtime] FAIL: ${script} reported precondition not met ` +
          "(likely missing seed data — try `npm run db:seed`)",
      );
    } else {
      console.error(
        `❌ [smoke:rls-runtime] FAIL: ${script} reported runtime RLS check failure ` +
          `(exit code ${code})`,
      );
    }
  }

  console.log(`\nTOTAL: ${totalAssertions} assertions across ${VERIFY_SCRIPTS.length} scripts`);

  if (anyFail) {
    console.error("\n❌ [smoke:rls-runtime] one or more runtime RLS checks failed");
    process.exit(1);
  }

  console.log("\n✅ [smoke:rls-runtime] all runtime RLS checks passed");
  process.exit(0);
}

main().catch(async (e) => {
  console.error("❌ [smoke:rls-runtime] wrapper error:", e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
