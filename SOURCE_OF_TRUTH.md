# Lawdger — Source of Truth

**Last updated:** 2026-06-12 (post-3.2.5b-ii, see migration history below)
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
- `src/lib/session.ts` — `getServerUser()`, `getServerScopedPrisma()`, `withServerUserContext()`. Redirects to `/login` if unauth.

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
| `User` | ✅ | 2 (`User_self_select`, `User_self_update`) | Owner-keyed via `current_setting('app.current_user_id', true)`; postgres superuser still bypasses (until 3.0.1). Auth pre-session path uses `auth_find_user_by_email` / `auth_create_user` SECURITY DEFINER RPCs. |
| `_prisma_migrations` | ✅ | 0 (default deny) | Infra table |
| `Case` | ✅ | 1 (`Case_isolation`) | userId scoped |
| `Note` | ✅ | 1 (`Note_isolation`) | userId scoped |
| `Task` | ✅ | 1 (`Task_isolation`) | userId scoped |
| `CalendarEvent` | ✅ | 1 (`CalendarEvent_isolation`) | userId scoped |
| `Payment` | ✅ | 1 (`Payment_isolation`) | userId scoped |
| `Document` | ✅ | 1 (`Document_isolation`) | userId scoped |

Verified by `npm run smoke:rls`.

### Current Runtime Isolation Posture

> **Warning:** RLS is structurally present but not enforced at runtime. Known design gap — remediation sequenced to Phase 3.0.1.

- 8 tables have RLS **enabled**; none are **FORCED**.
- `lawdger_app` Postgres role exists as a **NOLOGIN NOBYPASSRLS stub** (created in 3.2.5a). Cannot authenticate yet — password + table GRANTs + `DATABASE_URL` repoint all in 3.0.1.
- `DATABASE_URL` still connects as `postgres` superuser, which bypasses all RLS policies by default.
- Actual isolation today: app-layer `where: { userId }` filters in `caseActions.ts` (and migrated siblings).
- Auth pre-session path (`auth.ts`, `signup/actions.ts`) now routes through SECURITY DEFINER RPCs (`auth_find_user_by_email`, `auth_create_user`) — the narrow, audited surface that 3.0.1's `lawdger_app` role will use once it has EXECUTE-only privileges on these functions and no direct User-table access.
- Full DB-level enforcement (FORCE RLS + `lawdger_app` password + GRANTs + `DATABASE_URL` repoint) deferred to **Phase 3.0.1**.

### RLS pattern — why session variables, not `auth.uid()`

Prisma bypasses Supabase PostgREST entirely. `auth.uid()` is not available
inside Prisma queries. Policies use:

```sql
USING (current_setting('app.current_user_id', true)::text = "userId"::text)
```

The scoped Prisma client sets `SET LOCAL app.current_user_id = '<userId>'`
before each user-scoped query.

### Scoped Prisma Infrastructure

`src/lib/prisma-rls.ts` exports two patterns:

| Export | Use case |
|--------|----------|
| `getPrismaForUser(userId)` | Single-query paths — wraps each op in `$transaction` to set the GUC |
| `withUserContext(userId, async (tx) => {...})` | Multi-query paths — sets GUC once; all callback queries share the same `tx` |

`src/lib/session.ts` re-exports server-layer wrappers pre-seeded with session userId:
- `getServerScopedPrisma()` — `getPrismaForUser` seeded from session
- `withServerUserContext(async (tx) => {...})` — `withUserContext` seeded from session

**BAN (documented in `prisma-rls.ts` header — both deadlock on `connection_limit=1`):**
- No `$transaction([...])` array form against scoped clients
- No `Promise.all([scopedOp, scopedOp])` against scoped clients

### Action File Migration State

| File | Status | Notes |
|------|--------|-------|
| `src/actions/caseActions.ts` | ✅ Migrated | Zod, scoped Prisma, `where: { userId }`, `Result<T>` envelope |
| `src/actions/noteActions.ts` | ✅ Migrated | New in 3.2 — split from caseActions |
| `src/actions/taskActions.ts` | ⚠️ Partial | Case-task helpers scoped; own task ops still use bare `prisma`. Full contract uplift sequenced to **3.2.6**. |
| `src/actions/calendarActions.ts` | ✅ Scoped (3.2.5b-i) | Bare `prisma` → scoped patterns. **No Zod/Result yet** — contract uplift sequenced to 3.2.6. `where: { userId }` retained as defence-in-depth. |
| `src/actions/dashboardActions.ts` | ✅ Scoped (3.2.5b-i) | Bare `prisma` + 6-query `Promise.all` → single `withServerUserContext` interactive tx with sequential awaits. Page-level duplicate queries collapsed; `dashboard/page.tsx` now thin consumer of `getDashboardData()`. Contract uplift sequenced to 3.2.6. |
| `src/actions/financeActions.ts` | ✅ Scoped (3.2.5b-i) | Bare `prisma` → scoped; `assertCaseAccess` helper inlined into `createPayment`'s `withServerUserContext` tx. Contract uplift sequenced to 3.2.6. |
| `src/actions/settingsActions.ts` | ✅ Full contract (3.2.5b-ii) | Zod schemas + `Result<T>` envelope + scoped Prisma for `getFullProfile`, `updateProfile`, `updateWorkspacePreferences`, `updateNotificationPreferences`. `changePassword` retains legacy contract (`requireUserId` + base `prisma` + thrown errors / `PasswordState` shape) pending 3.0.1's auth-role layer + `auth_update_password` RPC. |
| `src/auth.ts` + signup actions | ✅ Migrated (3.2.5a) | Now use `prisma.$queryRaw` → `auth_find_user_by_email` / `auth_create_user` SECURITY DEFINER RPCs. Bare `prisma` import retained for the raw-query call site only. |

### Case model — enums and key fields

**`CaseStatus`** (enum): `ACTIVE` | `CLOSED`. Default `ACTIVE`. Replaces the former string `status` field.

**`MatterType`** (enum): `LITIGATION` | `ADVISORY` | `PRE_LITIGATION`. Default `LITIGATION`.

| Field | Type | Notes |
|-------|------|-------|
| `status` | `CaseStatus` | `ACTIVE \| CLOSED`; default `ACTIVE` |
| `matterType` | `MatterType` | `LITIGATION \| ADVISORY \| PRE_LITIGATION`; default `LITIGATION` |
| `court` | `String?` | Free-text court name |
| `caseNumber` | `String?` | Court-assigned case number |
| `caseType` | `String?` | String: CIVIL \| CRIMINAL \| WRIT \| APPEAL \| COMMERCIAL \| FAMILY \| ARBITRATION \| OTHER |
| `nextHearingDate` | `DateTime?` | |
| `filingDate` | `DateTime?` | |
| `actsSections` | `String?` | Pipe-delimited relevant acts/sections |
| `firNumber` | `String?` | For criminal matters |
| `policeStation` | `String?` | For criminal matters |

### Migration history

| Migration | Date | Purpose |
|-----------|------|---------|
| `0_init` | 2026-05-26 | Baseline schema (User, Case, Note, Task, CalendarEvent, Payment) |
| `20260527051415_add_documents_litigation_rls` | 2026-05-27 | Document model, Indian litigation fields on Case, RLS on 6 matter tables |
| `20260609030200_enable_rls_user_and_migrations` | 2026-06-09 | RLS on User + _prisma_migrations (default deny) |
| `20260609113647_phase_3_1_schema_cleanup` | 2026-06-09 | `CaseStatus` enum (ACTIVE \| CLOSED), `MatterType` enum (LITIGATION \| ADVISORY \| PRE_LITIGATION), `caseNumber` field; drop legacy string fields (courtName, forum, matterId) |
| `20260611142223_phase_3_2_5a_user_rls_and_auth_rpcs` | 2026-06-11 | `lawdger_app` NOLOGIN NOBYPASSRLS stub role; User owner-keyed SELECT + UPDATE policies (NULLIF-guarded GUC); `auth_find_user_by_email` + `auth_create_user` SECURITY DEFINER RPCs (EXECUTE granted to `lawdger_app` + `postgres`). Hand-authored — shadow DB workaround. |

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

> **Smoke verifies policy existence only — not runtime enforcement.** `smoke:rls` confirms the 8 policies are present; it does not verify they fire at runtime (the `postgres` superuser connection bypasses them). Known blindspot, documented for Phase 3.0.1 remediation.

`scripts/verify-isolation.ts`, `scripts/verify-phase32-rls.ts`, and `scripts/verify-with-user-context.ts` currently print "DEFERRED" and exit 0. Re-enabled in Phase 3.2.5 / 3.0.1.

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

### Larger debt (sequenced)

- `lawdger_app` Postgres role exists (3.2.5a) but only as NOLOGIN stub — no password, no table GRANTs. Runtime `DATABASE_URL` still connects as `postgres` superuser. Full enforcement (password + GRANTs + URL repoint + FORCE RLS): **Phase 3.0.1**.
- `settingsActions.changePassword` retains legacy contract (`requireUserId` + base `prisma` + thrown errors / `PasswordState` shape). Migration to full 3.2 `Result<T>` contract + `auth_update_password` SECURITY DEFINER RPC sequenced to **Phase 3.0.1** (depends on auth-role layer).
- `taskActions` legacy half — own task ops still on bare `prisma`. Full contract uplift sequenced to **Phase 3.2.6** (post-3.0.1).
- Contract uplift for `calendarActions` / `dashboardActions` / `financeActions` — currently scoped-only (3.2.5b-i), no Zod / no Result envelope. Full 3.2 contract sequenced to **Phase 3.2.6**.
- `scripts/verify-*.ts` are deferred stubs (print "DEFERRED", exit 0). Re-enable in **Phase 3.2.5c / 3.0.1**.
- `connection_limit` in `DATABASE_URL` bumped from `1` → `5` in Phase 3.2.1. `.env.example` reflects this. Not debt per se — sequenced expansion as enforced-RLS lands.
- `next-pwa` installed but unconfigured. Decision deferred to platform phase.

### Smaller debt — log + opportunistic

- **🚨 User-table queries require explicit `where: { id: session.id }` defence-in-depth — load-bearing until 3.0.1 FORCE RLS lands.** Until then, every scoped Prisma query against the User table (read AND write) MUST include explicit `where: { id: session.id }`. RLS policies on User are structural only at runtime: `relforcerowsecurity = false` + `DATABASE_URL` connects as `postgres` superuser, so the owner bypasses the `User_self_select` / `User_self_update` policies. A `findFirst()` with no where returns an arbitrary user; an `updateMany()` with no where mutates every row. Surfaced during 3.2.5b-ii smoke when an initial `getFullProfile()` returned the wrong user's profile; root-caused before commit. `smoke:rls` does not catch this — it only verifies policy existence. Audit task tracked under §13 phase 3.2.5c.
- **Chat route module-load 500.** `src/app/api/chat/route.ts` 500s at import time with `"use server" file can only export async functions, found object` — caused by the `type NoteCategory` re-export from `noteActions.ts`. Reproduces on `main` (verified during 3.2.5b-i smoke). Likely Turbopack/Next 16 mis-handling type-only re-exports from `"use server"` files. **Likely fix:** move `NoteCategory` type to a non-`"use server"` file (e.g. `src/actions/noteActions.types.ts`) and re-import. Dedicated session.
- **`prisma/seed.ts` upsert with `update: {}`.** On re-seed, existing users' password (and any other field) never refreshes. Stale hashes block dev login after auth-shape changes. **One-line fix:** change `update: {}` to `update: { password, name }`. Trivial separate PR.
- Stale worktree `.claude/worktrees/stoic-hamilton-d98127/` — 109 commits behind main. Cleanup pending.
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

---

## 13. Phase Roadmap

| Phase | Status | Summary |
|-------|--------|---------|
| 3.1 | ✅ Done | Schema cleanup — enums, caseNumber, drop legacy fields |
| 3.2 | ✅ Done | Server actions reconciliation — Zod, Result envelope, caseActions migrated |
| 3.2.1 | ✅ Done | Scoped Prisma multi-query pattern (`withUserContext`, `connection_limit=5`) |
| 3.2.5a | ✅ Done | Auth-path RLS RPCs (`auth_find_user_by_email`, `auth_create_user`) + User owner-keyed policies + `lawdger_app` NOLOGIN stub |
| 3.2.5b-i | ✅ Done | Minimal scoped-Prisma swap for `calendarActions`, `dashboardActions`, `financeActions` + collapse of duplicate 6-query block from `dashboard/page.tsx` (action becomes canonical). No contract uplift. |
| 3.2.5b-ii | ✅ Done | `settingsActions` full 3.2 contract (Zod + Result + scoped) for 4 of 5 functions; `SettingsClient` rewired to unwrap Result via `useActionState<ActionState, FormData>`. `changePassword` retained on legacy contract (deferred to 3.0.1). |
| 3.2.5c | ⏭️ Next | Re-enable `scripts/verify-*.ts` stubs; final doc pass before 3.0.1; **audit all scoped queries against the User table across the codebase — confirm explicit `where: { id: session.id }` on every read AND write before FORCE RLS** (load-bearing per §10 Smaller debt — surfaced 3.2.5b-ii) |
| 3.2.6 | ⏸️ Sequenced | Full contract uplift (Zod + Result) for `calendarActions` / `dashboardActions` / `financeActions` + `taskActions` legacy half. Sequenced **after** 3.0.1. |
| 3.0.1 | ⏸️ Sequenced | `lawdger_app` PASSWORD + table GRANTs + FORCE RLS + `DATABASE_URL` repoint (true DB enforcement) + `auth_update_password` RPC to unblock `settingsActions.changePassword` migration |
| 3.3+ | ⏸️ Deferred | Cases UI cleanup, New Matter dialog, CaseDetail real data |
