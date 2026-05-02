"use client"

import { Moon, Sun } from "lucide-react"
import { useState } from "react"

const STORAGE_KEY = "lawdger-theme"
const COOKIE_KEY = "lawdger-theme"

type Theme = "dark" | "light"
type ThemeToggleProps = {
  placement?: "floating" | "inline"
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove("dark", "light")
  root.classList.add(theme)
  root.style.colorScheme = theme
}

function persistTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  document.cookie = `${COOKIE_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`
}

export default function ThemeToggle({
  placement = "floating",
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("dark")
  const resolvedTheme: Theme =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("light")
      ? "light"
      : typeof document !== "undefined" &&
          document.documentElement.classList.contains("dark")
        ? "dark"
        : theme

  const nextTheme = resolvedTheme === "dark" ? "light" : "dark"
  const nextLabel = nextTheme === "light" ? "Light mode" : "Dark mode"
  const Icon = nextTheme === "light" ? Sun : Moon

  const className =
    placement === "inline"
      ? "group flex w-full items-center justify-between rounded-xl border border-[color:var(--surface-strong)] bg-[color:var(--surface-soft)] px-3 py-2.5 text-sm font-medium text-foreground shadow-[0_10px_30px_var(--shadow-elevated)] backdrop-blur-xl transition-all hover:scale-[1.01]"
      : "fixed right-4 top-4 z-[120] inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-strong)] bg-[color:var(--surface-soft)] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground shadow-[0_12px_32px_var(--shadow-elevated)] backdrop-blur-xl transition-all hover:scale-[1.02] sm:right-6 sm:top-6"

  function toggleTheme() {
    setTheme(nextTheme)
    applyTheme(nextTheme)
    persistTheme(nextTheme)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
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
