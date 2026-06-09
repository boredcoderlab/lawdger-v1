import { z } from "zod"

// Server-side environment schema.
// Validated at module load — importing this file from `auth.ts` (or any other
// server entry) guarantees the app fails fast at startup with a clear error
// if a required secret is missing or malformed.

const envSchema = z.object({
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters"),
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid Postgres connection URL"),
  DIRECT_URL: z
    .string()
    .url("DIRECT_URL must be a valid Postgres connection URL"),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
  )
  throw new Error("Invalid environment variables. See logs above.")
}

export const env = parsed.data
