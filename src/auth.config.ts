import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Matcher = denylist. Public paths (/login, /signup, /api/auth, static, landing.html)
      // are excluded at the matcher level and never reach this callback.
      const { pathname } = nextUrl
      // Root `/` redirects to /landing.html (public marketing) — must be reachable logged out.
      if (pathname === "/") return true
      // API routes (other than /api/auth) handle auth themselves and return 401 JSON —
      // middleware must not redirect them.
      if (pathname.startsWith("/api/")) return true
      return Boolean(auth?.user)
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      if (token.name) session.user.name = token.name
      return session
    },
  },
} satisfies NextAuthConfig
