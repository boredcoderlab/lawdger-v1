# Lawdger — Source of Truth

**Last updated:** 2026-06-14 (Phase 3.0.1 closed — local runtime RLS enforced; Vercel cutover deferred to Phase 9)
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

| Table | RLS | FORCE | Policy count | Notes |
|-------|-----|-------|--------------|-------|
| `User` | ✅ | ✅ | 2 (`User_self_select`, `User_self_update`) | Owner-keyed via `current_setting('app.current_user_id', true)`. Runtime-enforced as of 3.0.1d (runtime role = `lawdger_app`, NOBYPASSRLS). Auth pre-session path uses `auth_find_user_by_email` / `auth_create_user` / `auth_update_password` SECURITY DEFINER RPCs. |
| `_prisma_migrations` | ✅ | ❌ | 0 (default deny) | Infra table — FORCE deliberately omitted; postgres BYPASSRLS covers migration runner; `lawdger_app` has no GRANTs on this table. |
| `Case` | ✅ | ✅ | 1 (`Case_isolation`) | userId scoped |
| `Note` | ✅ | ✅ | 1 (`Note_isolation`) | userId scoped |
| `Task` | ✅ | ✅ | 1 (`Task_isolation`) | userId scoped |
| `CalendarEvent` | ✅ | ✅ | 1 (`CalendarEvent_isolation`) | userId scoped |
| `Payment` | ✅ | ✅ | 1 (`Payment_isolation`) | userId scoped |
| `Document` | ✅ | ✅ | 1 (`Document_isolation`) | userId scoped |

Verified by `npm run smoke:rls`.

### Current Runtime Isolation Posture

> **Status (Phase 3.0.1 closed — local runtime RLS enforced):** Local `DATABASE_URL` repointed to `lawdger_app` (NOBYPASSRLS). `smoke:rls-runtime` runs in **blocking mode** — 15/15 PASS confirmed. Manual smoke 10/10 PASS. Vercel `DATABASE_URL` swap deferred to **Phase 9 (Platform + deploy)**.

- 8 tables have RLS **ENABLED**; 7 app tables also have **FORCE ROW LEVEL SECURITY** (as of 3.0.1a). `_prisma_migrations` has ENABLED only.
- `lawdger_app` is a **fully hardened LOGIN role**: real password (in `.env.local` as `LAWDGER_APP_DB_PASSWORD`), NOBYPASSRLS, SELECT/INSERT/UPDATE/DELETE GRANTs on all 7 app tables, subject to FORCE RLS.
- **Local (live):** `DATABASE_URL` connects as `lawdger_app` via the transaction pooler (`lawdger_app.<project-ref>:<pw>@<host>:6543/postgres?pgbouncer=true&connection_limit=5`). RLS policies fire at runtime.
- **Vercel (deferred to Phase 9):** Production `DATABASE_URL` still points at `postgres` (BYPASSRLS). App-layer `where: { id }` / `where: { userId }` filters remain load-bearing isolation in production until Phase 9.
- `DIRECT_URL` stays on `postgres` throughout — Prisma migrate needs superuser. Only `DATABASE_URL` swapped in 3.0.1d.
- Auth pre-session path (`auth.ts`, `signup/actions.ts`, `changePassword`) routes through SECURITY DEFINER RPCs (`auth_find_user_by_email`, `auth_create_user`, `auth_update_password`). All three live and exercised.
- `smoke:rls-runtime` is wired into `npm run smoke`. Blocking mode active locally (exits 1 on any verify-script failure). Vercel production smoke happens in Phase 9.

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
| `src/actions/settingsActions.ts` | ✅ Full contract (3.2.5b-ii + 3.0.1c + 3.0.1e) | Zod schemas + `Result<T>` envelope + scoped Prisma for `getFullProfile`, `updateProfile`, `updateWorkspacePreferences`, `updateNotificationPreferences`. `changePassword` migrated (3.0.1c) — `getServerUser` + Zod + `bcrypt.compare`/`hash(_, 12)` + `auth_update_password` SECURITY DEFINER RPC via `$queryRaw` + `ActionState` envelope. User lookup patched (3.0.1e) — `prisma.user.findUnique` replaced with `$queryRaw` against `auth_find_user_by_email`; `session.email` explicit guard replaces `!` assertion. All five functions on the same contract. |
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
| `20260612204242_phase_3_0_1a_lawdger_app_grants_and_force_rls` | 2026-06-13 | `lawdger_app` promoted LOGIN + real password (manual post-apply step); SELECT/INSERT/UPDATE/DELETE GRANTs on 7 app tables; FORCE ROW LEVEL SECURITY on same 7 tables; embedded DO-block verification (role attrs + FORCE state + GRANT presence). Hand-authored — `prisma migrate resolve --applied`. |
| `20260613085732_phase_3_0_1b_auth_update_password_rpc` | 2026-06-13 | `auth_update_password(p_email text, p_password text) RETURNS TABLE(id, email, updatedAt)` — third SECURITY DEFINER RPC completing the auth-path trio. plpgsql, `SET search_path = public, pg_temp`, OWNER postgres, EXECUTE granted to `lawdger_app` + `postgres`. DO-block verification embedded. Hand-authored. |

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

The three `scripts/verify-*.ts` files (`verify-isolation.ts`, `verify-phase32-rls.ts`, `verify-with-user-context.ts`) are **fully implemented**, not stubs. They are intentionally unwired from `npm run smoke` because they require the runtime connection to be `lawdger_app` (NOBYPASSRLS) to yield meaningful results. Under the current `postgres` superuser `DATABASE_URL`, the default-deny bare-client checks will produce misleading results (superuser bypasses RLS). They become runnable post-3.0.1 when `DATABASE_URL` is repointed.

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

- **Runtime RLS enforcement: ✅ LIVE (local) — Vercel cutover deferred to Phase 9.** Full sequence: `lawdger_app` LOGIN + per-table GRANTs + FORCE RLS (3.0.1a ✅) + `auth_update_password` RPC (3.0.1b ✅) + `changePassword` contract uplift (3.0.1c ✅) + `smoke:rls-runtime` wrapper + local `DATABASE_URL` swap (3.0.1d ✅) + `changePassword` user-lookup RPC patch (3.0.1e ✅). Local `DATABASE_URL` repointed to `lawdger_app`; blocking smoke 15/15 PASS; manual smoke 10/10 PASS. Vercel production `DATABASE_URL` swap deferred to **Phase 9 (Platform + deploy)** — production still runs on `postgres` (BYPASSRLS); `where: { userId }` defence-in-depth remains load-bearing in prod.
- `taskActions` legacy half — own task ops still on bare `prisma`. Full contract uplift sequenced to **Phase 3.2.6** (post-3.0.1).
- Contract uplift for `calendarActions` / `dashboardActions` / `financeActions` — currently scoped-only (3.2.5b-i), no Zod / no Result envelope. Full 3.2 contract sequenced to **Phase 3.2.6**.
- `connection_limit` in `DATABASE_URL` stays at `5` under `lawdger_app`. Monitor post-cutover; bump to `10` if Prisma P2024 ("Timed out fetching a new connection") returns.
- `next-pwa` installed but unconfigured. Decision deferred to platform phase.

### Smaller debt — log + opportunistic

- **User-table where-clause requirement** (3.2.5b-ii smoke discovery — **audit completed in 3.2.5c, clean**): 9 call sites against `prisma.user.*` exist in `src/`, all in `settingsActions.ts`, all carry explicit `where: { id }` on reads and writes. Auth path (`auth.ts`, `signup/actions.ts`, `changePassword`) routes through SECURITY DEFINER RPCs. Post-3.0.1d these `where: { id }` clauses are **belt-and-braces** — RLS is the primary isolation guarantee. **Going-forward rule retained:** every new scoped query against User SHOULD include explicit `where: { id }` as defence-in-depth.
- **Chat route module-load 500.** `src/app/api/chat/route.ts` 500s at import time with `"use server" file can only export async functions, found object` — caused by the `type NoteCategory` re-export from `noteActions.ts`. Reproduces on `main` (verified during 3.2.5b-i smoke). Likely Turbopack/Next 16 mis-handling type-only re-exports from `"use server"` files. **Likely fix:** move `NoteCategory` type to a non-`"use server"` file (e.g. `src/actions/noteActions.types.ts`) and re-import. Dedicated session.
- **`prisma/seed.ts` upsert with `update: {}`.** On re-seed, existing users' password (and any other field) never refreshes. Stale hashes block dev login after auth-shape changes. **One-line fix:** change `update: {}` to `update: { password, name }`. Trivial separate PR.
- **`prisma/seed.ts` RLS bypass for seed runs.** Under `lawdger_app` + FORCE RLS, User INSERT/UPDATE policies deny the seed upsert (no `app.current_user_id` GUC set). Workaround: override `DATABASE_URL` at invocation time — `DATABASE_URL="$(grep ^DIRECT_URL .env.local | cut -d= -f2-)" npx prisma db seed` — substitutes the `postgres` superuser URL for the seed run only. Real fix (later): route user creation through `auth_create_user` RPC inside `seed.ts`, or instantiate a dedicated `PrismaClient` with `DIRECT_URL` inside the script.
- **`prisma migrate resolve --applied` hangs under MCP / non-interactive session.** Root cause: `_prisma_migrations` has default-deny RLS; `lawdger_app` can't INSERT the migration row, so the command blocks waiting for a lock it can never acquire. Workaround: (a) run `dotenv -e .env.local -- npx prisma migrate resolve --applied <name>` directly in a terminal (not via Claude Code Bash); or (b) hand-author the migration SQL + register via `$queryRaw` INSERT into `_prisma_migrations` as `postgres` (pattern used in 3.0.1a and 3.0.1b). Do NOT attempt `migrate resolve` through Claude Code's Bash tool while `DATABASE_URL` points at `lawdger_app`.
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
| 3.2.5c | ✅ Done | Doc pass: corrected SOT §7/§10 stale "DEFERRED stubs" claim (scripts are fully implemented, unwired pending 3.0.1); User-table where-clause audit (clean, 9/9 call sites carry `where:{id}`); `PHASE_3_2_5_PLAN.md` archived. |
| 3.2.6 | ⏸️ Sequenced | Full contract uplift (Zod + Result) for `calendarActions` / `dashboardActions` / `financeActions` + `taskActions` legacy half. Sequenced **after** 3.0.1. |
| 3.0.1a | ✅ Done | `lawdger_app` LOGIN + real password (manual post-apply) + SELECT/INSERT/UPDATE/DELETE GRANTs on 7 app tables + FORCE ROW LEVEL SECURITY on same 7 tables. DB layer hardened. |
| 3.0.1b | ✅ Done | `auth_update_password(p_email, p_password)` SECURITY DEFINER RPC — third auth-path RPC completing the trio. REVOKE/GRANT mirrors 3.2.5a. Reachable; consumed in 3.0.1c. |
| 3.0.1c | ✅ Done | `settingsActions.changePassword` migrated to full 3.2 `Result<T>`/`ActionState` contract calling `auth_update_password` RPC. `SettingsClient` unwrap matches the other four actions. Pure TypeScript — no DB migration. |
| 3.0.1d | ✅ Done | `scripts/check-rls-runtime.ts` wrapper + `smoke:rls-runtime` wired into `npm run smoke` (blocking mode). Local `.env.local` `DATABASE_URL` repointed to `lawdger_app`; `smoke:rls-runtime` 15/15 PASS; manual smoke 10/10 PASS. Vercel `DATABASE_URL` swap + production smoke deferred to **Phase 9 (Platform + deploy)**. |
| 3.0.1e | ✅ Done | `src/actions/settingsActions.ts` `changePassword` user-lookup patched — `prisma.user.findUnique({ where: { id } })` replaced with `$queryRaw` against `auth_find_user_by_email`; explicit `session.email` guard added. Discovered during 3.0.1 manual smoke Step 6 FAIL (same FORCE RLS root cause). PR #13. **Phase 3.0.1 closed.** |
| 3.3+ | ⏸️ Deferred | Cases UI cleanup, New Matter dialog, CaseDetail real data |

---

## 14. Rollback

### 3.0.1d — runtime cutover (the only app-affecting rollback in 3.0.1)

**Failure mode A — local smoke fails before Vercel swap:**
Revert `.env.local` `DATABASE_URL` to the `postgres` form. No production impact. Diagnose offline and re-attempt.

**Failure mode B — Vercel swap deployed, app broken in prod:**
1. Vercel dashboard → revert `DATABASE_URL` to the `postgres` form (the legacy line is kept commented in `.env.example` for reference).
2. Trigger redeploy.
3. App returns to working state on `postgres` (BYPASSRLS active, but functional). `where: { userId }` defence-in-depth holds.
4. Root-cause offline before re-attempting.

**Failure mode C — data corruption suspected post-cutover:**
1. Supabase dashboard → trigger PITR restore to the pre-swap checkpoint timestamp.
2. Vercel `DATABASE_URL` → revert to `postgres`.
3. Redeploy.

### 3.0.1a → 3.0.1c rollback summary
- **3.0.1a:** Revert migration via DROP GRANTs / `ALTER ROLE lawdger_app NOLOGIN` / `ALTER TABLE … NO FORCE RLS`. App on `postgres` throughout — no runtime impact during rollback.
- **3.0.1b:** `DROP FUNCTION IF EXISTS public.auth_update_password(text, text);` + `DELETE FROM _prisma_migrations WHERE migration_name = '20260613085732_phase_3_0_1b_auth_update_password_rpc';`. Harmless even if rolled forward through 3.0.1c since `changePassword` would simply error on the missing RPC — revert 3.0.1c first.
- **3.0.1c:** `git revert` the merge commit. `auth_update_password` RPC stays (harmless if unused). App reverts to legacy `changePassword`. No app downtime.
