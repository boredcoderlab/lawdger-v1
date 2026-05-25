import { z } from "zod"

/**
 * Server-side environment schema.
 *
 * Validated at module load — importing this file from `auth.ts` (or any other
 * server entry) guarantees the app fails fast at startup with a clear error
 * if a required secret is missing or malformed.
 *
 * NextAuth v5 uses `AUTH_SECRET` (NOT `NEXTAUTH_SECRET`).
 */
const EnvSchema = z.object({
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters (NextAuth v5)."),
  DATABASE_URL: z.url("DATABASE_URL must be a valid connection URL."),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n")
  throw new Error(`❌ Invalid environment variables:\n${issues}`)
}

export const env = parsed.data
