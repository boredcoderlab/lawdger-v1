# Lawdger — Source of Truth

**Last updated:** 2026-06-23 (Phase 4-B backend closed — auto-event pipeline for Next Date notes; main @ `f1d43c5`)
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
- **Current main sha:** `f1d43c5` (Phase 4-B backend — PR #19)

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
- **Current `.env.local` reality (Sahil's home IPv4 network):** `DIRECT_URL`
  operationally points at the pgbouncer pooler (port 6543), NOT the direct
  endpoint. This contradicts §4 intent but reflects working state. Schema
  migrations through `prisma migrate diff` hang as a result — use the
  Supabase MCP `execute_sql` + manual `_prisma_migrations` INSERT detour
  documented in PR #16. **Fix deferred to Phase 9** (Supabase IPv4 add-on
  or session-pooler endpoint).

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
| `Note` | ✅ | ✅ | 1 (`Note_isolation`) | userId scoped. `nextDate DateTime?` added 4-B (auto-event branch input). |
| `Task` | ✅ | ✅ | 1 (`Task_isolation`) | userId scoped. `isUrgent Boolean @default(false)` added 4-A.1. |
| `CalendarEvent` | ✅ | ✅ | 1 (`CalendarEvent_isolation`) | userId scoped. `noteId String? @unique` added 4-B (one-to-one Note↔Event linkage; DB-enforced). |
| `Payment` | ✅ | ✅ | 1 (`Payment_isolation`) | userId scoped |
| `Document` | ✅ | ✅ | 1 (`Document_isolation`) | userId scoped |

Verified by `npm run smoke:rls`.

### Current Runtime Isolation Posture

> **Status (Phase 3.0.1 closed — local runtime RLS enforced):** Local `DATABASE_URL` repointed to `lawdger_app` (NOBYPASSRLS). `smoke:rls-runtime` runs in **blocking mode** — **27/27 PASS** confirmed (post-4-B: +5 Pillar B CalendarEvent/noteId/cascade/past-date assertions). Manual smoke 10/10 PASS. Vercel `DATABASE_URL` swap deferred to **Phase 9 (Platform + deploy)**.

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

**Verify-script cleanup hooks** (Pillar A learning, PR #16) MUST run under
`getPrismaForUser(userId)` GUC — never `baseClient`. FORCE RLS at `lawdger_app`
makes unscoped `deleteMany` match zero rows silently.

### Action File Migration State

| File | Status | Notes |
|------|--------|-------|
| `src/actions/caseActions.ts` | ✅ Migrated | Zod, scoped Prisma, `where: { userId }`, `Result<T>` envelope |
| `src/actions/noteActions.ts` | ✅ Migrated (upgraded 4-B) | New in 3.2 — split from caseActions. **4-B:** both `createNote` and `deleteNote` upgraded `getServerScopedPrisma` → `withServerUserContext` for atomic note↔event linkage. `createNote` auto-creates linked `CalendarEvent` inline (NOT via `createCalendarEvent` action) when category=`"Next Date"` AND `nextDate >= startOfTodayIST()`. `deleteNote` cascades event-then-note in one tx. |
| `src/actions/taskActions.ts` | ⚠️ Partial | `listAllTasks` 3.2-compliant additive (4-A.2). Case-task helpers scoped. Own task ops (legacy L28–150) still use bare `prisma`. Full contract uplift sequenced to **3.2.6**. |
| `src/actions/calendarActions.ts` | ✅ Scoped (3.2.5b-i) | Bare `prisma` → scoped patterns. `getCasesForSelect` extended with `caseNumber` in 4-A.2. `createCalendarEvent` gained optional `noteId?: string` param in 4-B (backward-compat; only future explicit callers exercise it — `createNote` issues `tx.calendarEvent.create` directly inline for atomicity). **No Zod/Result yet** — contract uplift sequenced to 3.2.6. `where: { userId }` retained as defence-in-depth. |
| `src/actions/dashboardActions.ts` | ✅ Scoped (3.2.5b-i) | Bare `prisma` + 6-query `Promise.all` → single `withServerUserContext` interactive tx with sequential awaits. Page-level duplicate queries collapsed; `dashboard/page.tsx` now thin consumer of `getDashboardData()`. Contract uplift sequenced to 3.2.6. |
| `src/actions/financeActions.ts` | ✅ Scoped (3.2.5b-i) | Bare `prisma` → scoped; `assertCaseAccess` helper inlined into `createPayment`'s `withServerUserContext` tx. Contract uplift sequenced to 3.2.6. |
| `src/actions/settingsActions.ts` | ✅ Full contract (3.2.5b-ii + 3.0.1c + 3.0.1e) | All five functions on 3.2 contract. |
| `src/auth.ts` + signup actions | ✅ Migrated (3.2.5a) | Use `prisma.$queryRaw` → `auth_find_user_by_email` / `auth_create_user` SECURITY DEFINER RPCs. |

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

### Task model — key fields (post-4-A)

| Field | Type | Notes |
|-------|------|-------|
| `status` | `String` | `pending \| completed`; default `pending` |
| `assignee` | `String` | Default `"Unassigned"`; bucketed via `src/lib/task-bucket.ts` into `unassigned \| my-plate \| associates` |
| `dueDate` | `DateTime?` | |
| `isUrgent` | `Boolean` | Default `false`. Added 4-A.1. Drives gold URGENT pill on /tasks + CaseDetail docket. |
| `priority` | — | **DROPPED in 4-A.2** — was TypeScript-only fiction, never in schema. |

### Migration history

| Migration | Date | Purpose |
|-----------|------|---------|
| `0_init` | 2026-05-26 | Baseline schema (User, Case, Note, Task, CalendarEvent, Payment) |
| `20260527051415_add_documents_litigation_rls` | 2026-05-27 | Document model, Indian litigation fields on Case, RLS on 6 matter tables |
| `20260609030200_enable_rls_user_and_migrations` | 2026-06-09 | RLS on User + _prisma_migrations (default deny) |
| `20260609113647_phase_3_1_schema_cleanup` | 2026-06-09 | `CaseStatus` enum, `MatterType` enum, `caseNumber` field |
| `20260611142223_phase_3_2_5a_user_rls_and_auth_rpcs` | 2026-06-11 | `lawdger_app` NOLOGIN stub; User owner-keyed policies; `auth_find_user_by_email` + `auth_create_user` SECURITY DEFINER RPCs |
| `20260612204242_phase_3_0_1a_lawdger_app_grants_and_force_rls` | 2026-06-13 | `lawdger_app` LOGIN + GRANTs + FORCE RLS on 7 app tables |
| `20260613085732_phase_3_0_1b_auth_update_password_rpc` | 2026-06-13 | `auth_update_password` SECURITY DEFINER RPC |
| `20260619230018_add_task_is_urgent` | 2026-06-19 | `Task.isUrgent Boolean @default(false)`. Applied via Supabase MCP `execute_sql` + manual `_prisma_migrations` INSERT (pgbouncer pooler blocked `prisma migrate diff`). |
| `20260622000000_phase_4_b_auto_event_pipeline` | 2026-06-22 | `Note.nextDate DateTime?` + `CalendarEvent.noteId String? @unique`. Both additive, both nullable. Applied via Supabase MCP `apply_migration` + manual `_prisma_migrations` INSERT (checksum `6a2aff8b…`, row id `53d7eb8a-…`). |

---

## 7. CI / Smoke Gate

Run before every merge to main:

```bash
npm run smoke
```

This runs in order:
1. `smoke:tsc` — `tsc --noEmit`, no TypeScript errors
2. `smoke:prisma` — `prisma validate`, schema sanity
3. `smoke:rls` — `scripts/check-rls.ts`, RLS posture matches §6 (8 tables)
4. `smoke:rls-runtime` — `scripts/check-rls-runtime.ts` orchestrates 5 verify scripts:
   - `verify-isolation.ts` (4 checks)
   - `verify-phase32-rls.ts` (6 checks — Case isolation)
   - `verify-with-user-context.ts` (5 checks — withUserContext)
   - `verify-phase4-rls.ts` (7 checks — Task isolation, added 4-A.3; check 7 added 4-A.4)
   - `verify-pillar-b-rls.ts` (5 checks — CalendarEvent isolation + noteId fail-closed + cascade + past-date skip, added 4-B)

   **Total: 27 RLS assertions.** Blocking mode — any FAIL exits 1.

Any failure blocks the merge.

---

## 8. Workflow Rules

- **One feature per branch.** No direct commits to main except trivial doc/config (SOT updates exempt).
- **One logical unit per commit.** Atomic, reversible.
- **TSC clean** before every commit.
- **Smoke clean** before every merge to main.
- **Indian-jurisdiction defaults** for all legal domain logic.
- **No `any`.** Proper types.
- **Every API route:** Zod-validated input.
- **Every DB op:** through Prisma, never raw SQL in app code.
- **No `Promise.all` over scoped Prisma ops.** Sequential awaits via `withServerUserContext`.
- **Manual smoke + Chrome MCP empirical visual verification** mandatory before merge (Phase 3.5 hard rule).
- **Verify-script cleanup hooks** scoped under `getPrismaForUser` GUC, never `baseClient`.

---

## 9. Tooling

| Tool | Purpose |
|------|---------|
| Claude Chat (Opus 4.7) | Architecture, prompt authorship |
| Claude Code (Sonnet 4.6 / Opus 4.7) | Execution |
| `dotenv-cli` | Bridge `.env.local` → Prisma CLI |
| `tsx` | Run TypeScript scripts directly |
| Supabase MCP | DB inspection + `execute_sql` migration fallback |
| Chrome MCP | Empirical visual verification (CP4 standard) |
| GitHub MCP | PR ops |
| `next-themes` | Light / dark / system theme |
| ~~`dnd-kit`~~ | Dropped in 4-A.2 TasksClient rewrite; deps remain in `package.json` (P9 cleanup). |

### CC prompt format (mandatory)

Every Claude Code prompt for Lawdger must include:
- Model recommendation at top (Sonnet 4.6 default; Opus 4.7 for complex)
- One-line reason for model choice
- Hard constraints
- Locked decisions
- Pre-flight reads
- Action steps with ⛔ hard-stop checkpoints
- Verification
- Explicit "DO NOT" list
- STOP and Report at final checkpoint

---

## 10. Known Tech Debt

### Larger debt (sequenced)

- **Runtime RLS enforcement: ✅ LIVE (local) — Vercel cutover deferred to Phase 9.**
- `taskActions` legacy half — own task ops (toggle/delete/create on bare `prisma`) still pre-3.2. `listAllTasks` 3.2-compliant additive shipped 4-A.2. Full contract uplift sequenced to **Phase 3.2.6**.
- Drag-drop between Kanban columns — dropped in 4-A.2. Restoration committed to **3.2.6 sprint**, bound to legacy `updateTaskAssignee` 3.2-compliant uplift.
- Contract uplift for `calendarActions` / `dashboardActions` / `financeActions` — currently scoped-only (3.2.5b-i), no Zod / no Result envelope. Sequenced to **Phase 3.2.6**.
- `connection_limit` in `DATABASE_URL` stays at `5` under `lawdger_app`. Monitor post-cutover; bump to `10` if Prisma P2024 returns.
- `next-pwa` installed but unconfigured. Decision deferred to platform phase.

### Smaller debt — log + opportunistic

- **`.env.local` `DIRECT_URL` on pooler 6543** (Sahil's IPv4-only home network). Forces Supabase MCP detour for schema migrations. Fix at **P9 cutover** via Supabase IPv4 add-on or session-pooler endpoint.
- **dnd-kit deps in `package.json`** despite TasksClient rewrite dropping imports. Audit + prune at **P9 cleanup**.
- **Dark mode emulation via Chrome MCP** doesn't toggle Tailwind `.dark` class strategy. Out of scope until P9 or user-facing bug surfaces.
- **User-table where-clause requirement:** going-forward rule — every new scoped query against User SHOULD include explicit `where: { id }` as defence-in-depth.
- **`prisma/seed.ts` upsert with `update: {}`.** On re-seed, existing users' password never refreshes. One-line fix: change `update: {}` to `update: { password, name }`.
- **`prisma/seed.ts` RLS bypass for seed runs.** Workaround: `DATABASE_URL="$(grep ^DIRECT_URL .env.local | cut -d= -f2-)" npx prisma db seed`. Real fix: route user creation through `auth_create_user` RPC inside seed script.
- **`prisma migrate dev` broken** (shadow DB issue from migration `20260609030200`). All future schema changes use `migrate diff` + `migrate deploy`, OR the Supabase MCP `execute_sql` + manual `_prisma_migrations` INSERT detour documented in PR #16.
- **`prisma migrate resolve --applied` hangs under MCP / non-interactive session.** Workaround: run directly in terminal, or hand-author + register via `execute_sql`.
- Stale worktree `.claude/worktrees/stoic-hamilton-d98127/` — cleanup pending.
- Dead `claude/*` branches — prune pending.

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
| 3.2.1 | ✅ Done | Scoped Prisma multi-query pattern |
| 3.2.5a | ✅ Done | Auth-path RLS RPCs + User owner-keyed policies + `lawdger_app` NOLOGIN stub |
| 3.2.5b-i | ✅ Done | Minimal scoped-Prisma swap for calendarActions / dashboardActions / financeActions |
| 3.2.5b-ii | ✅ Done | `settingsActions` full 3.2 contract (4 of 5 functions) |
| 3.2.5c | ✅ Done | Doc pass + User-table where-clause audit |
| 3.2.6 | ⏸️ Sequenced | Full contract uplift for calendarActions / dashboardActions / financeActions + taskActions legacy half + drag-drop restoration (`updateTaskAssignee` uplift). Sequenced **after** Phase 4 Pillar B. |
| 3.0.1a | ✅ Done | `lawdger_app` LOGIN + GRANTs + FORCE RLS |
| 3.0.1b | ✅ Done | `auth_update_password` SECURITY DEFINER RPC |
| 3.0.1c | ✅ Done | `changePassword` 3.2 contract migration |
| 3.0.1d | ✅ Done | `smoke:rls-runtime` blocking; local `DATABASE_URL` → `lawdger_app` |
| 3.0.1e | ✅ Done | `changePassword` user-lookup RPC patch. **Phase 3.0.1 closed.** |
| 3.5 | ✅ Done | Cases UI hygiene — 5 layout gaps closed; CaseDetail layout consolidated; Phase 4 Pillar C pulled forward (`NoteCategory` extraction) |
| **4-C** | ✅ Done | Pulled forward into 3.5.1-h. `NOTE_CATEGORIES` + `NoteCategory` extracted to `noteActions.types.ts`. |
| **4-A** | ✅ Done | **PR #16 (main @ `fff9901`).** Killed `/tasks` SEED, wired to DB. 3-col Kanban (Unassigned / My Plate / Associates). `isUrgent` flag added (4-A.1 migration + 4-A.2 UI threading). CaseDetail Append Task carries urgent checkbox + docket pill. `listAllTasks` 3.2-compliant additive. `verify-phase4-rls.ts` (6 new RLS checks). |
| **4-A.4** | ✅ Done | **PR #17 (main @ `45084ac`).** `updateCaseTask` server action (Zod, owner-check via `case.userId` join, `Result<TaskRow>`). `EditTaskDialog` two-tap flow (AssignedCard → TaskDetailDialog → Edit → EditTaskDialog). Optimistic re-bucketing with `structuredClone` snapshot/rollback. `doneThisWeek` staleness fixed in `handleToggle` + `handleDelete` (deriveStats helper). `verify-phase4-rls.ts` check 7 added. `USER_B_EMAIL` case fixed in all 4 verify scripts. Smoke: tsc + 8-table RLS + 22 runtime assertions (7/7 phase-4). |
| **4-A.5** | ✅ Done | **PR #18 (main @ `e7aae6d`).** `handleCreate` `doneThisWeek` staleness fixed — explicit next-arrays computed before `setStats(deriveStats(...))`, matching A.4 `handleToggle`/`handleDelete` pattern. |
| **4-A.6** | ✅ Done | **PR #18 (main @ `e7aae6d`).** Case-chip in `AssignedCard` → `<Link href="/cases/[caseId]">` with `stopPropagation`. `UnassignedCard` chip scoped out (different markup, no toggle surface). |
| **4-B (backend)** | ✅ Done | **PR #19 (main @ `f1d43c5`).** Auto-event pipeline backend for Next Date notes (B.1 + B.2). `Note.nextDate` + `CalendarEvent.noteId @unique` schema migration. `createNote` auto-creates linked event inline when category="Next Date" AND `nextDate >= startOfTodayIST()`; `deleteNote` cascades event-then-note. Both upgraded to `withServerUserContext` for atomicity. Gemini `create_note` tool gains optional `nextDate` param with "ONLY when category is 'Next Date'" guard. `verify-pillar-b-rls.ts` (+5 RLS assertions, 22→27 total). |
| **4-B.3** | ⏸️ Sequenced | UI polish on backend pipeline. Three substantive items: (a) calendar chip detects UTC-midnight `hearingDate` → renders "All day" instead of "5:30 IST"; (b) note-delete UI affordance on case-detail timeline; (c) date-hint in note display (show `nextDate` if populated) + past-date banner. Storage stays UTC midnight — display-layer fix only. |
| **4-A.7** | ⏸️ Sequenced | CaseDetailClient edit dialog (deferred from A.4 queue). Independent surface from 4-B.3. |
| **`updateNote` + note-edit UI** | ⏸️ Sequenced | Note lifecycle gap. Currently no edit path; users delete + recreate. Deferred per 4-B locked scope. |
| 5–9 | ⏸️ Sequenced | Dashboard real data → Finances → Legal Brain (RAG) → Inbox → Settings → **Phase 9** Vercel cutover + DIRECT_URL fix + dnd-kit prune + PWA decision |

---

## 14. Rollback

### 4-B — Auto-event pipeline backend (PR #19)

**Failure mode A — auto-event regression discovered post-merge:**
1. `git revert f1d43c5` on a hotfix branch.
2. Schema columns stay (`Note.nextDate`, `CalendarEvent.noteId`) — additive nullable, harmless. Strict revert requires dropping the migration: `ALTER TABLE "Note" DROP COLUMN "nextDate"; DROP INDEX "CalendarEvent_noteId_key"; ALTER TABLE "CalendarEvent" DROP COLUMN "noteId";` + `_prisma_migrations` row delete for `20260622000000_phase_4_b_auto_event_pipeline`.
3. Existing rows with non-null values: zero (pre-merge data has all nulls; only Pillar B flow populated either column).
4. `npm run smoke` + Chrome MCP visual check.
5. PR to main, fast-track merge.

**Failure mode B — `withServerUserContext` upgrade introduces tx-timeout regression in `createNote`/`deleteNote`:**
1. Same revert path as Failure mode A.
2. Investigate `prisma.$transaction` `{ maxWait: 5_000, timeout: 15_000 }` headroom under load — bump if needed before re-merging.

### 4-A.5+A.6 — handleCreate stat fix + case-chip link (PR #18)

**Failure mode — regression post-merge:**
1. `git revert e7aae6d` on a hotfix branch.
2. `npm run smoke` + Chrome MCP visual check.
3. PR to main, fast-track merge.
4. No schema changes — DB rollback not required.

### 4-A.4 — Task edit dialog (PR #17)

**Failure mode A — EditTaskDialog regression post-merge:**
1. `git revert 45084ac` on a hotfix branch.
2. `npm run smoke` + Chrome MCP visual check.
3. PR to main, fast-track merge.
4. No schema changes in this PR — DB rollback not required.

### 4-A — Phase 4 Pillar A (PR #16)

**Failure mode A — TasksClient regression discovered post-merge:**
1. `git revert <fff9901>` on a hotfix branch.
2. Smoke + Chrome MCP visual verification.
3. PR to main, fast-track merge.
4. `isUrgent` column stays in schema (harmless if unused) — strict rollback requires also reverting migration `20260619230018_add_task_is_urgent` via `ALTER TABLE "Task" DROP COLUMN "isUrgent";` + `_prisma_migrations` row delete.

### 3.0.1d — runtime cutover

**Failure mode A — local smoke fails before Vercel swap:** Revert `.env.local` `DATABASE_URL` to `postgres` form.

**Failure mode B — Vercel swap deployed, app broken in prod:** Vercel → revert `DATABASE_URL` → redeploy. App returns to `postgres` (BYPASSRLS active, functional). `where: { userId }` holds.

**Failure mode C — data corruption suspected post-cutover:** Supabase PITR restore + Vercel revert + redeploy.

### 3.0.1a → 3.0.1c rollback summary
- **3.0.1a:** Revert migration via DROP GRANTs / `ALTER ROLE lawdger_app NOLOGIN` / `ALTER TABLE … NO FORCE RLS`.
- **3.0.1b:** `DROP FUNCTION IF EXISTS public.auth_update_password(text, text);` + `_prisma_migrations` row delete.
- **3.0.1c:** `git revert` the merge commit. `auth_update_password` RPC stays (harmless if unused).