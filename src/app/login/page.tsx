'use client'

import Image from "next/image"
import Link from "next/link"
import { useActionState } from "react"

import { login, type LoginState } from "./actions"

const initialState: LoginState = {
  message: "",
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground transition-colors">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <div className="w-full rounded-[28px] border border-[color:var(--surface-strong)] bg-card/80 p-8 shadow-[0_30px_80px_var(--shadow-elevated)] backdrop-blur-xl sm:p-10">
          <Link href="/" className="mb-8 inline-flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-[color:var(--surface-strong)] bg-surface-soft">
              <Image
                src="/lawdger-logo-transparent.png"
                alt="Lawdger"
                fill
                className="object-cover"
                priority
              />
            </div>
            <span className="font-serif text-3xl font-semibold tracking-tight">
              Lawdger
            </span>
          </Link>

          <div className="mb-8">
            <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-accent">
              Welcome back
            </p>
            <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-foreground">
              Sign in to your practice.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Pick up where you left off and head straight into Lawdger.
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                className="w-full rounded-2xl border border-[color:var(--surface-strong)] bg-surface-soft px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:bg-card/90"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Password
              </span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-[color:var(--surface-strong)] bg-surface-soft px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:bg-card/90"
              />
            </label>

            <div className="pt-2">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pending ? "Signing In..." : "Sign In"}
              </button>
            </div>

            <p
              aria-live="polite"
              className="min-h-5 text-sm text-muted-foreground"
            >
              {state.message}
            </p>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-accent transition hover:opacity-80">
              Sign up →
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
