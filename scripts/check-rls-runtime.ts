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
 *       BLOCKING mode. Run the three verify scripts in sequence as
 *       child processes (matches the existing smoke:rls invocation
 *       pattern for check-rls.ts). Propagate non-zero exit codes.
 *
 * Child scripts spawned (sequentially, never parallel):
 *   1. scripts/verify-isolation.ts          — exit 0 pass, 1 fail
 *   2. scripts/verify-phase32-rls.ts        — exit 0 pass, 1 fail
 *   3. scripts/verify-with-user-context.ts  — exit 0 pass, 1 fail,
 *                                              2 precondition (missing seed)
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
];

async function detectRole(): Promise<string> {
  const rows = await prisma.$queryRaw<{ current_user: string }[]>`SELECT current_user`;
  return rows[0]?.current_user ?? "unknown";
}

function runChild(script: string): number {
  console.log(`\n──── running ${script} ────`);
  const result = spawnSync("npx", ["tsx", script], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
  return result.status ?? 1;
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
  for (const script of VERIFY_SCRIPTS) {
    const code = runChild(script);
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
