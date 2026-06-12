import "@/env" // validates required env vars at boot — throws if missing
import { compare } from "bcryptjs"
import NextAuth, { type DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
  }
}

interface AuthUserRow {
  id: string
  email: string
  name: string | null
  password: string | null
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        // Pre-session call — no userId GUC available. Routes through the
        // SECURITY DEFINER RPC `auth_find_user_by_email` introduced in
        // migration 20260611142223_phase_3_2_5a_user_rls_and_auth_rpcs.
        // EXECUTE granted to lawdger_app + postgres only.
        const rows = await prisma.$queryRaw<AuthUserRow[]>`
          SELECT id, email, name, password
          FROM public.auth_find_user_by_email(${email})
        `
        const user = rows[0] ?? null

        if (!user || !user.password) {
          return null
        }

        const isValidPassword = await compare(password, user.password)

        if (!isValidPassword) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
  ],
})
