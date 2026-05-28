import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getPrismaForUser } from "@/lib/prisma-rls"

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
 * Use this in server components, server actions, and route handlers for
 * ALL tenant-data reads/writes (Case, Note, Task, CalendarEvent, Payment,
 * Document). Do NOT use for the auth path itself — the base `prisma`
 * client handles User lookup (User has no RLS).
 *
 * Example:
 *   const db = await getServerScopedPrisma()
 *   const cases = await db.case.findMany()
 */
export async function getServerScopedPrisma() {
  const user = await getServerUser()
  return getPrismaForUser(user.id)
}
