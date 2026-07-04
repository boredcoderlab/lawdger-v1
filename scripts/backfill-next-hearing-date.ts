/**
 * Backfill Case.nextHearingDate from existing CalendarEvent rows.
 *
 * PR7 Block 3 makes CalendarEvent the sole source of truth for
 * Case.nextHearingDate — createCalendarEvent/updateCalendarEvent/
 * deleteCalendarEvent now call syncNextHearingDate on every mutation, and
 * manual form input for the field has been removed. Cases created before
 * this change carry whatever was last typed into the old form (or null),
 * which may be stale or simply never matched any real CalendarEvent. This
 * script recomputes the column for every existing case, once, from actual
 * CalendarEvent rows.
 *
 * Safe to re-run — syncNextHearingDate always recomputes from current
 * CalendarEvent state; it never accumulates or depends on prior runs.
 *
 * Uses DIRECT_URL (postgres superuser) rather than the app connection —
 * a backfill is an admin operation, needs to see every user's cases
 * regardless of RLS, and has no session context anyway.
 *
 * Run:
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-next-hearing-date.ts
 *
 * NOT run automatically as part of this change — hand back for Sahil to
 * run manually, per the project's migration convention.
 */

import { PrismaClient } from "@prisma/client"
import { syncNextHearingDate } from "../src/lib/calendar-sync"

async function main() {
  const directUrl = process.env.DIRECT_URL
  if (!directUrl) {
    throw new Error(
      "DIRECT_URL not set — required for admin backfill (bypasses RLS via postgres superuser)",
    )
  }

  // Supabase's DIRECT_URL still routes through pgbouncer on port 6543;
  // Prisma prepared statements collide there ("prepared statement s0
  // already exists") on subsequent runs. `pgbouncer=true` tells Prisma to
  // skip prepared-statement caching, which is safe for a one-shot script.
  const pooledUrl = directUrl.includes("?") ? `${directUrl}&pgbouncer=true` : `${directUrl}?pgbouncer=true`

  const admin = new PrismaClient({
    datasources: { db: { url: pooledUrl } },
    log: ["error", "warn"],
  })

  const cases = await admin.case.findMany({ select: { id: true } })
  console.log(`Found ${cases.length} case(s) to process.\n`)

  let synced = 0
  let failed = 0

  for (const c of cases) {
    try {
      await admin.$transaction(async (tx) => {
        await syncNextHearingDate(c.id, tx)
      })
      synced++
    } catch (e) {
      failed++
      console.error(`FAILED case=${c.id}:`, e)
    }
  }

  console.log(`\nDone.`)
  console.log(`  synced: ${synced}`)
  console.log(`  failed: ${failed}`)

  await admin.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
