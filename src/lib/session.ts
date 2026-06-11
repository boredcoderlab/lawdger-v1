import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import { auth } from "@/auth"
import { getPrismaForUser, withUserContext } from "@/lib/prisma-rls"

export async function getServerUser() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }
  return session.user
}

/**
 * Returns a Prisma client scoped to the currently authenticated user.
 * Every query goes through the RLS extension: each operation runs inside
 * a transaction that first sets `app.current_user_id`, so row-level
 * policies filter to this user's rows only.
 *
 * Use this for SINGLE-query reads/writes in server components, server
 * actions, and route handlers (Case, Note, Task, CalendarEvent, Payment,
 * Document). For multi-query actions, prefer `withServerUserContext`.
 *
 * Do NOT use for the auth path itself — the base `prisma` client handles
 * User lookup (User has no RLS).
 *
 * Example:
 *   const db = await getServerScopedPrisma()
 *   const cases = await db.case.findMany()
 */
export async function getServerScopedPrisma() {
  const user = await getServerUser()
  return getPrismaForUser(user.id)
}

/**
 * Run a callback inside one RLS-scoped interactive transaction tied to
 * the currently authenticated user. Wraps `withUserContext` with the
 * server-side auth acquisition.
 *
 * Use whenever an action issues more than one query against the scoped
 * client — replaces the buggy `Promise.all([scopedOp, scopedOp])` and
 * array-form `$transaction([...])` patterns. See src/lib/prisma-rls.ts
 * for the architecture rationale.
 *
 * Example:
 *   return withServerUserContext(async (tx) => {
 *     const items = await tx.case.findMany({ where, skip, take, orderBy })
 *     const total = await tx.case.count({ where })
 *     return { ok: true, data: { items, total } }
 *   })
 */
export async function withServerUserContext<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const user = await getServerUser()
  return withUserContext(user.id, fn)
}
