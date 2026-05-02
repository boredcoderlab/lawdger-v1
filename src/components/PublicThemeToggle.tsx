"use client"

import { usePathname } from "next/navigation"

import ThemeToggle from "@/components/ThemeToggle"

const PRODUCT_ROUTE_PREFIXES = [
  "/dashboard",
  "/cases",
  "/calendar",
  "/tasks",
  "/finances",
  "/settings",
  "/chat",
  "/lawdger",
]

export default function PublicThemeToggle() {
  const pathname = usePathname()
  const isProductRoute = PRODUCT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (isProductRoute) {
    return null
  }

  return <ThemeToggle placement="floating" />
}
