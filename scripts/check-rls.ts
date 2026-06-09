// scripts/check-rls.ts
// Smoke gate: verifies RLS posture matches SOURCE_OF_TRUTH.md §6.
// Run via: dotenv -e .env.local -- tsx scripts/check-rls.ts
// Exit 0 on success, 1 on any mismatch.

import { PrismaClient } from "@prisma/client"

type RlsRow = {
  table: string
  rls_enabled: boolean
  policy_count: bigint
}

// Expected posture per table.
// exactRequired = true means policy_count must equal minPolicies exactly
// (default-deny tables — service role bypass only).
const EXPECTED: Record<
  string,
  { rls: true; minPolicies: number; exactRequired: boolean }
> = {
  User: { rls: true, minPolicies: 0, exactRequired: true },
  _prisma_migrations: { rls: true, minPolicies: 0, exactRequired: true },
  Case: { rls: true, minPolicies: 1, exactRequired: false },
  Note: { rls: true, minPolicies: 1, exactRequired: false },
  Task: { rls: true, minPolicies: 1, exactRequired: false },
  CalendarEvent: { rls: true, minPolicies: 1, exactRequired: false },
  Payment: { rls: true, minPolicies: 1, exactRequired: false },
  Document: { rls: true, minPolicies: 1, exactRequired: false },
}

async function main(): Promise<void> {
  const prisma = new PrismaClient()
  const tableList = Object.keys(EXPECTED)

  const rows = await prisma.$queryRawUnsafe<RlsRow[]>(
    `
    SELECT
      c.relname AS "table",
      c.relrowsecurity AS "rls_enabled",
      (
        SELECT count(*)
        FROM pg_policies p
        WHERE p.schemaname = n.nspname
          AND p.tablename = c.relname
      ) AS "policy_count"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY($1::text[])
    `,
    tableList
  )

  await prisma.$disconnect()

  const failures: string[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    seen.add(row.table)
    const expected = EXPECTED[row.table]
    if (!expected) continue

    if (row.rls_enabled !== expected.rls) {
      failures.push(
        `❌ ${row.table}: rls_enabled=${row.rls_enabled}, expected ${expected.rls}`
      )
    }

    const policyCount = Number(row.policy_count)

    if (expected.exactRequired && policyCount !== expected.minPolicies) {
      failures.push(
        `❌ ${row.table}: policy_count=${policyCount}, expected exactly ${expected.minPolicies} (default-deny)`
      )
    } else if (!expected.exactRequired && policyCount < expected.minPolicies) {
      failures.push(
        `❌ ${row.table}: policy_count=${policyCount}, expected >= ${expected.minPolicies}`
      )
    }
  }

  for (const t of tableList) {
    if (!seen.has(t)) {
      failures.push(`❌ ${t}: table not found in public schema`)
    }
  }

  if (failures.length > 0) {
    console.error("RLS smoke check FAILED:\n" + failures.join("\n"))
    process.exit(1)
  }

  console.log(
    `✅ RLS smoke check passed — ${tableList.length} tables verified.`
  )
}

main().catch((err: unknown) => {
  console.error("RLS smoke check ERRORED:", err)
  process.exit(1)
})
