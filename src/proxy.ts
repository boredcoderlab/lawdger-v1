import { NextResponse } from "next/server"

import { auth } from "@/auth"

const PROTECTED_ROUTES = [
  "/dashboard",
  "/cases",
  "/tasks",
  "/calendar",
  "/finances",
  "/chat",
  "/settings",
]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = Boolean(req.auth?.user)
  const isAuthPage = pathname === "/login" || pathname === "/signup"
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )

  if (!isAuthenticated && isProtected) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/cases/:path*",
    "/tasks/:path*",
    "/calendar/:path*",
    "/finances/:path*",
    "/chat/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
  ],
}
