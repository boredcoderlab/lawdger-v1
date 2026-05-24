"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

type ThemeToggleProps = {
  placement?: "floating" | "inline"
}

export default function ThemeToggle({
  placement = "floating",
}: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  const className =
    placement === "inline"
      ? "group flex w-full items-center justify-between rounded-xl border border-[color:var(--surface-strong)] bg-[color:var(--surface-soft)] px-3 py-2.5 text-sm font-medium text-foreground shadow-[0_10px_30px_var(--shadow-elevated)] backdrop-blur-xl transition-all hover:scale-[1.01]"
      : "fixed right-4 top-4 z-[120] inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-strong)] bg-[color:var(--surface-soft)] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground shadow-[0_12px_32px_var(--shadow-elevated)] backdrop-blur-xl transition-all hover:scale-[1.02] sm:right-6 sm:top-6"

  if (!mounted) {
    return (
      <button type="button" aria-label="Theme toggle" className={className} disabled>
        <span className="inline-flex items-center gap-2">
          <Moon className="h-4 w-4 opacity-0" />
          <span className="opacity-0">Dark mode</span>
        </span>
      </button>
    )
  }

  const isDark = resolvedTheme === "dark"
  const nextTheme = isDark ? "light" : "dark"
  const nextLabel = isDark ? "Light mode" : "Dark mode"
  const Icon = isDark ? Moon : Sun

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextLabel.toLowerCase()}`}
      className={className}
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span>{nextLabel}</span>
      </span>
    </button>
  )
}
