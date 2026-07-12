'use server'

import { hash } from "bcryptjs"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { signIn } from "@/auth"
import { prisma } from "@/lib/prisma"

export type SignupState = {
  message: string
}

const DASHBOARD_PATH = "/dashboard"

// Mirrors changePasswordSchema (settingsActions.ts) — min-8 password parity.
// Account creation was the weakest link (N57): no strength rule, no email
// format check, accepted 1-char passwords.
const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
})

interface AuthFindUserRow {
  id: string
  email: string
  name: string | null
}

interface AuthCreateUserRow {
  id: string
  email: string
  name: string | null
  createdAt: Date
  updatedAt: Date
}

export async function createAccount(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  const parsed = createAccountSchema.safeParse({ name, email, password, confirmPassword })
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  // Pre-session lookup — routes through SECURITY DEFINER RPC from
  // migration 20260611142223_phase_3_2_5a_user_rls_and_auth_rpcs.
  const existingRows = await prisma.$queryRaw<AuthFindUserRow[]>`
    SELECT id, email, name
    FROM public.auth_find_user_by_email(${email})
  `

  if (existingRows.length > 0) {
    return { message: "An account with this email already exists." }
  }

  try {
    const passwordHash = await hash(password, 12)

    // INSERT via SECURITY DEFINER RPC. Race-condition path: unique_violation
    // inside the RPC is re-raised with message 'EMAIL_ALREADY_EXISTS' and
    // SQLSTATE 23505, which Prisma surfaces as a raw-query error (P2010)
    // with the inner code preserved.
    await prisma.$queryRaw<AuthCreateUserRow[]>`
      SELECT id, email, name, "createdAt", "updatedAt"
      FROM public.auth_create_user(${email}, ${passwordHash}, ${name})
    `
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2010 wraps RAISE EXCEPTION from inside the RPC; the meta payload
      // varies by Prisma version, so check both the inner code and the
      // marker string we raise.
      const meta = error.meta as Record<string, unknown> | undefined
      const innerCode = typeof meta?.code === "string" ? meta.code : undefined
      const innerMessage = typeof meta?.message === "string" ? meta.message : ""
      if (
        error.code === "P2010" &&
        (innerCode === "23505" || innerMessage.includes("EMAIL_ALREADY_EXISTS"))
      ) {
        return { message: "An account with this email already exists." }
      }
      // Defensive fallback for P2002 if Prisma ever unwraps the constraint
      // violation directly instead of going through P2010.
      if (error.code === "P2002") {
        return { message: "An account with this email already exists." }
      }
    }

    throw error
  }

  await signIn("credentials", {
    email,
    password,
    redirectTo: DASHBOARD_PATH,
  })
  // signIn always redirects — this is unreachable
  return { message: "" }
}
