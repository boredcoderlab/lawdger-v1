# Lawdger — Source of Truth

**Last updated:** 2026-06-09
**Maintainer:** Sahil Jain
**Status:** Active development — pre-MVP

This document is the canonical reference for the Lawdger codebase. If anything
in here contradicts another doc, this wins. Update it when reality changes.

---

## 1. Product

Voice-first AI legal case management platform built for Indian litigation
lawyers. Voice → AI classification → routes input to case timeline, task,
calendar event, or payment record. Positioned as a "dedicated AI-trained
legal clerk." Target users: advocates in High Courts, Supreme Court, and
district/trial courts.

---

## 2. Repository

- **GitHub:** `boredcoderlab/lawdger-v1`
- **Local working dir:** `~/Lawdger_MVP_v1`
- **Default branch:** `main`

---

## 3. Stack (locked)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript strict (no `any`) |
| UI | Tailwind v4 + custom shadcn/ui-style tokens |
| Design tokens | `globals.css @theme inline` — SOLE source. `tailwind.config.ts` is dead code. Do not edit it. |
| DB | Supabase Postgres (project ref: `mhgupsgjftbubnkuadge`, region `ap-northeast-1`) |
| ORM | Prisma (standard `@prisma/client`) |
| Auth | NextAuth v5 Credentials + JWT |
| Voice | Google Gemini API |
| Storage | Supabase Storage (planned) |
| Deploy | Vercel (planned) |

---

## 4. Environment Variables

All secrets live in `.env.local` (gitignored). `.env.example` is the canonical
list. `src/env.ts` validates required vars at boot — app fails fast on
missing/malformed values.

| Var | Required | Purpose |
|-----|----------|---------|
| `AUTH_SECRET` | ✅ | NextAuth session signing (min 32 chars) |
| `DATABASE_URL` | ✅ | App runtime queries (pooled, port 6543) |
| `DIRECT_URL` | ✅ | Prisma migrations (session mode, port 5432) |
| `GOOGLE_API_KEY` | ✅ | Gemini API |
| `LLM_*` | optional | LLM provider config |

### Database URL gotchas

- **Same password for both URLs.** One Supabase DB password controls both.
- **Reset:** Supabase Dashboard → Settings → Database → Reset database password.
- **No `@` in passwords** — URL parser breaks. If unavoidable, URL-encode as `%40`.
- **No smart/curly quotes** — copy-paste from formatted docs can break parsing.
- **DIRECT_URL on IPv4 networks:** the direct host
  `db.<PROJECT_REF>.supabase.co:5432` is IPv6-only on some Supabase regions.
  Use the session-mode pooler instead:
  `postgresql://postgres.<PROJECT_REF>:<PASS>@<HOST>.pooler.supabase.com:5432/postgres`

---

## 5. Auth Architecture

- `src/auth.ts` — full NextAuth config + Credentials provider. Server-only.
  Imports bcryptjs and Prisma. Do NOT import from middleware.
- `src/auth.config.ts` — edge-safe config (no Prisma, no bcrypt). Used by
  `proxy.ts` so middleware works on Edge Runtime.
- `src/proxy.ts` — Next.js 16 middleware entry point. **Not `middleware.ts`** —
  Next 16 auto-runs `proxy.ts` and silently ignores `middleware.ts`.
- `src/lib/session.ts` — `getServerUser()` helper, redirects to `/login` if unauth.

### Route protection model

**Denylist, not allowlist.** The middleware matcher protects everything except:
- `/api/auth/*`
- `/_next/static/*`, `/_next/image/*`, `/favicon.ico`
- `/login`, `/signup`, `/landing.html`

The `(lawdger)` group layout also calls `auth()` as defence-in-depth.

### API routes need their own auth check

Middleware excludes ALL `/api/*` (not just `/api/auth/*`). Every new API route
MUST call `auth()` in its handler. There is no automatic protection.

---

## 6. Data Layer

### RLS posture

| Table | RLS | Policy count | Notes |
|-------|-----|--------------|-------|
| `User` | ✅ | 0 (default deny) | Prisma service role bypasses |
| `_prisma_migrations` | ✅ | 0 (default deny) | Infra table |
| `Case` | ✅ | 1 (`Case_isolation`) | userId scoped |
| `Note` | ✅ | 1 (`Note_isolation`) | userId scoped |
| `Task` | ✅ | 1 (`Task_isolation`) | userId scoped |
| `CalendarEvent` | ✅ | 1 (`CalendarEvent_isolation`) | userId scoped |
| `Payment` | ✅ | 1 (`Payment_isolation`) | userId scoped |
| `Document` | ✅ | 1 (`Document_isolation`) | userId scoped |

Verified by `npm run smoke:rls`.

### RLS pattern — why session variables, not `auth.uid()`

Prisma bypasses Supabase PostgREST entirely. `auth.uid()` is not available
inside Prisma queries. Policies use:

```sql
USING (current_setting('app.current_user_id', true)::text = "userId"::text)
```

The scoped Prisma client sets `SET LOCAL app.current_user_id = '<userId>'`
before each user-scoped query.

### Migration history

| Migration | Date | Purpose |
|-----------|------|---------|
| `0_init` | 2026-05-26 | Baseline schema (User, Case, Note, Task, CalendarEvent, Payment) |
| `20260527051415_add_documents_litigation_rls` | 2026-05-27 | Document model, Indian litigation fields on Case, RLS on 6 matter tables |
| `20260609030200_enable_rls_user_and_migrations` | 2026-06-09 | RLS on User + _prisma_migrations (default deny) |

---

## 7. CI / Smoke Gate

Run before every merge to main:

```bash
npm run smoke
```

This runs in order:
1. `smoke:tsc` — `tsc --noEmit`, no TypeScript errors
2. `smoke:prisma` — `prisma validate`, schema sanity
3. `smoke:rls` — `scripts/check-rls.ts`, RLS posture matches §6

Any failure blocks the merge.

---

## 8. Workflow Rules

- **One feature per branch.** No direct commits to main except trivial doc/config.
- **One logical unit per commit.** Atomic, reversible.
- **TSC clean** before every commit.
- **Smoke clean** before every merge to main.
- **Indian-jurisdiction defaults** for all legal domain logic.
- **No `any`.** Proper types.
- **Every API route:** Zod-validated input.
- **Every DB op:** through Prisma, never raw SQL in app code.

---

## 9. Tooling

| Tool | Purpose |
|------|---------|
| Claude Chat (Opus) | Architecture, prompt authorship |
| Claude Code (Sonnet 4.6 / Opus 4.7) | Execution |
| `dotenv-cli` | Bridge `.env.local` → Prisma CLI |
| `tsx` | Run TypeScript scripts directly |
| Supabase MCP | Read-only DB inspection in Claude Code |
| `next-themes` | Light / dark / system theme |
| `dnd-kit` | Drag-and-drop for Tasks Kanban |

### CC prompt format (mandatory)

Every Claude Code prompt for Lawdger must include:
- Model recommendation at top (Sonnet 4.6 default; Opus 4.7 for complex)
- One-line reason for model choice
- Hard constraints
- Diagnostic before fix (read current state)
- Single-file scope when possible
- Incremental commits inside the session
- Explicit "do NOT" list

---

## 10. Known Tech Debt

- `next-pwa` installed but unconfigured. Decision deferred to platform phase.
- Stale worktree `.claude/worktrees/stoic-hamilton-d98127/` — 109 commits
  behind main. Cleanup pending.
- Dead `claude/*` branches (5× at SHA `3374d3d`). Prune pending.

---

## 11. Open Forks (need resolution)

| Fork | Status |
|------|--------|
| Platform: Web-first PWA vs React Native | Web-first now, RN as parallel later track |
| Auth providers: Credentials only vs + Google OAuth | TBD — likely add OAuth pre-launch |
| Gemini data retention vs no-retention tier | **VERIFY** — pitch claims "no AI training on user data"; must confirm Gemini API retention terms hold for legal confidentiality |
| "E2E encrypted, legal-grade" marketing claim | **RECONCILE** — incompatible with server-side AI processing. Likely rescope to "encrypted at rest + in transit". |

---

## 12. Team

| Role | Person |
|------|--------|
| Founder / CEO | Sahil Jain |
| Lead Engineer (React Native) | Salil Jain |
| Business Strategy | Siddharth Jain |
| AI Engineer | Chirag Chetnani |
| Backend Lead | Pratham Gyanani |
