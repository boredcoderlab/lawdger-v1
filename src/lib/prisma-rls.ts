import { prisma } from "@/lib/prisma"

/**
 * Returns a Prisma client extension that scopes every operation to a single
 * authenticated user. Each query is wrapped in a transaction that first sets
 * `app.current_user_id` via `set_config(..., true)` (transaction-local, so
 * safe with PgBouncer transaction pooling). RLS policies on every tenant
 * table read that GUC to filter rows.
 *
 * Must run as the restricted `lawdger_app` role (NOBYPASSRLS). The base
 * `prisma` client connects via DATABASE_URL — repoint that at lawdger_app
 * before relying on this for isolation.
 */
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
