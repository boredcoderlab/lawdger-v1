"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Theme toggle"
        disabled
        className="text-muted-icon dark:text-foreground-secondary cursor-pointer"
      >
        <Moon strokeWidth={1.5} size={22} className="opacity-0" />
      </button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="text-muted-icon dark:text-foreground-secondary hover:text-muted-icon-hover dark:hover:text-foreground transition-colors cursor-pointer"
    >
      {isDark ? (
        <Sun strokeWidth={1.5} size={22} />
      ) : (
        <Moon strokeWidth={1.5} size={22} />
      )}
    </button>
  )
}
