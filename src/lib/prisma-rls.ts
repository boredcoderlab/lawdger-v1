/**
 * RLS-scoped Prisma access.
 *
 * Two patterns. Pick correctly.
 *
 *   getPrismaForUser(userId)  — for SINGLE-query operations.
 *     Each operation runs in its own transaction with `set_config`
 *     applied transaction-locally. Safe with PgBouncer transaction-mode
 *     pooling and connection_limit ≥ 1.
 *
 *   withUserContext(userId, async (tx) => { ... })  — for MULTI-query
 *     operations that need atomicity OR want to run more than one query
 *     against the scoped client.
 *     Opens ONE interactive transaction, applies set_config once, runs
 *     every query in the callback on the same `tx` client. Single
 *     connection, correct isolation, no nesting.
 *
 * BAN: Never run parallel queries against the scoped client. That means
 *   NO `prisma.$transaction([a, b, c])` array form (the extension wraps
 *     each op in its own transaction; the array runs them in parallel).
 *   NO `Promise.all([db.case.findMany(...), db.case.count(...)])` —
 *     same shape, same failure: each scoped op opens its own transaction,
 *     and they fight for the pgbouncer-pooled connection slots.
 * Both deadlock against `connection_limit` and surface as Prisma P2024
 * "Timed out fetching a new connection". This applies to every
 * src/actions/* module, current and future.
 *
 * For parallel reads OR multi-query atomicity, use callback-form
 * `$transaction` via `withUserContext` instead. Inside the callback all
 * queries share one connection and run serially under the same GUC.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export function getPrismaForUser(userId: string) {
  if (!userId) throw new Error("getPrismaForUser: userId required")

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`,
            query(args),
          ])
          return result as unknown
        },
      },
    },
  })
}

/**
 * Run a callback inside ONE interactive transaction, with
 * `app.current_user_id` GUC set transaction-locally for the entire span.
 *
 * Use for any action that issues more than one query against the scoped
 * client. Inside `fn`, call `tx.case.findMany(...)`, `tx.case.count(...)`,
 * etc. — all queries share one connection and the same RLS context.
 *
 * The `set_config(..., true)` third argument scopes the GUC to this
 * transaction only. NEVER pass `false` here — under PgBouncer transaction
 * pooling a session-level GUC would leak across tenants on the next
 * connection re-use.
 *
 * The userId interpolation uses Prisma's tagged-template binding, so it
 * is parameterized (not string-concatenated) — SQL-injection safe.
 *
 * Transaction options:
 *   maxWait 5s  — time we'll wait to acquire a pool connection.
 *   timeout 15s — max wall-time the callback can hold the transaction.
 * Comfortable headroom over the 10s Prisma pool-acquisition default
 * without permitting runaway long-running actions.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!userId) throw new Error("withUserContext: userId required")

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`
      return fn(tx)
    },
    { maxWait: 5_000, timeout: 15_000 },
  )
}
