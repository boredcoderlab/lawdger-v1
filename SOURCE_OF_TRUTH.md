# Lawdger — Source of Truth

**Last updated:** 2026-06-27 (Audit reconciliation @ 5.2b — 37 new findings + 4 §10 under-counts corrected; closed @ `082affb`)
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
- **Current main sha:** `082affb` (Phase 5.2b — server-side finances aggregation + formatINR extraction — PR #25)

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

> **Status (Phase 3.0.1 closed — local runtime RLS enforced):** Local `DATABASE_URL` repointed to `lawdger_app` (NOBYPASSRLS). `smoke:rls-runtime` runs in **blocking mode** — **28/28 PASS** confirmed across **6 verify scripts** (count was 27/5, corrected to 23/5 at 4-A.7 CP-8 — prior 4-C.1 SOT flip incorrectly said 23/4; bumped to 28/6 at 5.2a with `verify-phase52-finances-rls.ts` +5 Payment assertions; see §7). Manual smoke 10/10 PASS. Vercel `DATABASE_URL` swap deferred to **Phase 9 (Platform + deploy)**.

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
| `src/actions/noteActions.ts` | ✅ Migrated (upgraded 4-C.1) | New in 3.2 — split from caseActions. **4-B:** both `createNote` and `deleteNote` upgraded `getServerScopedPrisma` → `withServerUserContext` for atomic note↔event linkage. `createNote` auto-creates linked `CalendarEvent` inline (NOT via `createCalendarEvent` action) when category=`"Next Date"` AND `nextDate >= startOfTodayIST()`. `deleteNote` cascades event-then-note in one tx. **4-C.1:** `updateNote` added — Zod + superRefine (conditional `nextDate`), owner-chain `case.findFirst` → `note.findFirst`, 8-row transition matrix for note↔CalendarEvent re-sync (update/delete/create/no-op per old-cat × new-cat × date future-ness). `verify-phase4-c1-update-rls.ts` deferred (+3 assertions — next RLS hardening batch). |
| `src/actions/taskActions.ts` | ⚠️ Partial | `listAllTasks` 3.2-compliant additive (4-A.2). Case-task helpers scoped. Own task ops (legacy L28–150) still use bare `prisma`. Full contract uplift sequenced to **3.2.6**. **4-A.7:** updateCaseTask UI wiring — added `revalidatePath(\`/cases/${caseId}\`)` at L362 (fixes stale SSR in CaseDetailClient after task edit; /tasks revalidate retained). |
| `src/actions/calendarActions.ts` | ✅ Scoped (3.2.5b-i) | Bare `prisma` → scoped patterns. `getCasesForSelect` extended with `caseNumber` in 4-A.2. `createCalendarEvent` gained optional `noteId?: string` param in 4-B (backward-compat; only future explicit callers exercise it — `createNote` issues `tx.calendarEvent.create` directly inline for atomicity). **No Zod/Result yet** — contract uplift sequenced to 3.2.6. `where: { userId }` retained as defence-in-depth. |
| `src/actions/dashboardActions.ts` | ✅ Migrated (5.1) | Single-shot reads for dashboard tiles: `todayEvents` + `upcomingEvents` (`CalendarEvent`, IST-aware range via `startOfTodayIST`/`endOfTodayIST`), `pendingTasks` (`Task`, `status=pending`, `take:10`), `allCases` with `nextHearingDate` (computed via `groupBy` on `CalendarEvent` — `Case.nextHearingDate` column is form-driven schema debt, routed around), `totalCases` (`status=ACTIVE`), `totalTasks` (`status=pending`). Owner-scoped via `requireUserId()`. Mock fallbacks killed. Contract uplift (Zod/Result) sequenced to 3.2.6. |
| `src/lib/date.ts` | ✅ Shared util (5.1) | `startOfTodayIST` (pre-5.1) + `endOfTodayIST`, `istDateKey`, `formatIndianDate` extracted 5.1 (third-consumer trigger fired). `istDateKey` output changed `DD/MM/YYYY` → `YYYY-MM-DD`; all 6 consumer sites verified key-use only (no render uses), swap invisible at runtime. `formatIndianDate` uses `day:"numeric"` + explicit `Asia/Kolkata` timezone. |
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
4. `smoke:rls-runtime` — `scripts/check-rls-runtime.ts` orchestrates verify scripts:
   - `verify-isolation.ts` (4 checks)
   - `verify-phase32-rls.ts` (6 checks — Case isolation)
   - `verify-with-user-context.ts` (5 checks — withUserContext)
   - `verify-phase4-rls.ts` (7 checks — Task isolation, added 4-A.3; check 7 added 4-A.4)
   - `verify-pillar-b-rls.ts` (5 checks — CalendarEvent isolation + noteId fail-closed + cascade + past-date skip, added 4-B)
   - `verify-phase52-finances-rls.ts` (5 checks — Payment isolation: SELECT iso + cross-user SELECT/UPDATE/DELETE fail-closed + INSERT mismatched-userId blocked by `WITH CHECK`, added 5.2a)

   **Total: 28 RLS assertions across 6 scripts** (corrected 27→23 at 4-C.1; prior SOT flip mistakenly said 4 scripts — actual is 5: isolation/phase32-rls/with-user-context/phase4-rls/pillar-b-rls; bumped to 28/6 at 5.2a with `verify-phase52-finances-rls.ts` +5). Two pending: `verify-phase4-c1-update-rls.ts` (updateNote, +3) and `verify-phase4-a7-update-task-rls.ts` (updateCaseTask, similar shape) — next RLS hardening batch. Blocking mode — any FAIL exits 1.

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

**Reconciliation pass 2026-06-27**: 4 existing entries (L7/L8/S2/S12) expanded to reflect full debt class scope. 37 new findings (N1–N37) catalogued in subsection below. Audit report: `/tmp/AUDIT_REPORT_2026-06-27.md` (Sahil's machine, not committed).

### Larger debt (sequenced)

- **Runtime RLS enforcement: ✅ LIVE (local) — Vercel cutover deferred to Phase 9.**
- `taskActions` legacy half — own task ops (toggle/delete/create on bare `prisma`) still pre-3.2. `listAllTasks` 3.2-compliant additive shipped 4-A.2. Full contract uplift sequenced to **Phase 3.2.6**.
- Drag-drop between Kanban columns — dropped in 4-A.2. Restoration committed to **3.2.6 sprint**, bound to legacy `updateTaskAssignee` 3.2-compliant uplift.
- Contract uplift for `calendarActions` / `dashboardActions` / `financeActions` — currently scoped-only (3.2.5b-i), no Zod / no Result envelope. Sequenced to **Phase 3.2.6**.
- `connection_limit` in `DATABASE_URL` stays at `5` under `lawdger_app`. Monitor post-cutover; bump to `10` if Prisma P2024 returns.
- `next-pwa` installed but unconfigured. Decision deferred to platform phase.
- **`Payment.amount` Float → Int paise + `Case.agreedFee` Float? → Int paise (sibling)** — destructive ×100 backfill, same migration window; both carry FP rounding risk. Resolve together in **schema-cleanup pass**.
- **String-as-enum migration — `Payment.status`, `Case.caseType`, `Note.category`, `Task.status`, `Document.status`** — free-text fields with no DB-level constraint. Sequenced to **schema-cleanup pass** (Prisma enums); contract-side enforcement covered by **3.2.6**.
- **`updateCaseAgreedFee` shape.** Uses `getServerScopedPrisma` + `updateMany` (fail-closed via where-clause, not owner-chain precheck). Functional but inconsistent with `withServerUserContext` + owner-check pattern used elsewhere. Uplift sequenced to **Phase 3.2.6**.

### Smaller debt — log + opportunistic

- **`.env.local` `DIRECT_URL` on pooler 6543** (Sahil's IPv4-only home network). Forces Supabase MCP detour for schema migrations. Fix at **P9 cutover** via Supabase IPv4 add-on or session-pooler endpoint.
- **Unused runtime deps prune** — `@dnd-kit/{core,sortable,utilities}` + `next-pwa` — 4 deps with zero `src/` refs. Also `@types/bcryptjs` misplaced under `dependencies` (move to `devDependencies`). Resolve in **PR6** dep + token hygiene.
- **Dark mode emulation via Chrome MCP** doesn't toggle Tailwind `.dark` class strategy. Out of scope until P9 or user-facing bug surfaces.
- **User-table where-clause requirement:** going-forward rule — every new scoped query against User SHOULD include explicit `where: { id }` as defence-in-depth.
- **`prisma/seed.ts` upsert with `update: {}`.** On re-seed, existing users' password never refreshes. One-line fix: change `update: {}` to `update: { password, name }`.
- **`prisma/seed.ts` RLS bypass for seed runs.** Workaround: `DATABASE_URL="$(grep ^DIRECT_URL .env.local | cut -d= -f2-)" npx prisma db seed`. Real fix: route user creation through `auth_create_user` RPC inside seed script.
- **`prisma migrate dev` broken** (shadow DB issue from migration `20260609030200`). All future schema changes use `migrate diff` + `migrate deploy`, OR the Supabase MCP `execute_sql` + manual `_prisma_migrations` INSERT detour documented in PR #16.
- **`prisma migrate resolve --applied` hangs under MCP / non-interactive session.** Workaround: run directly in terminal, or hand-author + register via `execute_sql`.
- Stale worktree `.claude/worktrees/stoic-hamilton-d98127/` — cleanup pending.
- **`Case.nextHearingDate` schema debt** — column is form-driven only (written on case create/update via form), NOT synced with `CalendarEvent` mutations (no write in `calendarActions` create/update/delete, no write in `noteActions` auto-event create from "Next Date" or 4-C.1 re-sync, no write on case-delete cascade). Phase 5.1 routed around via `groupBy` on `CalendarEvent`. Resolve in schema-cleanup pass: either (i) drop column + remove from case form, OR (ii) backfill on every calendar mutation path.
- **Recent Documents real wiring deferred to Phase 6** — Phase 5.1 ships honest empty state. Wire to `Document` table when Inbox/upload flow lands.
- **Zero `onDelete` clauses schema-wide** — every relation defaults to Restrict. App-layer cascades exist for Case (4 children) and Note (calendar event). User-delete will hit Restrict on all child relations. Resolve in **schema-cleanup pass** alongside enum + paise migrations.
- **`CaseDetailClient.tsx` `value={info.agreedFee ? formatINR(parseFloat(info.agreedFee)) : null}`.** `info.agreedFee` is `string` from Prisma `Float?` serialization through this code path (form-state typing); `parseFloat` bridge before `formatINR` is type-debt — should be `number | null` end-to-end. Defer to **Phase 3.2.6** contract uplift.
- **`verify-phase52-finances-rls.ts` A5 cosmetic.** `insertErrMsg` logs as empty string due to Prisma error string leading newline (`e.message.split("\n")[0]` returns `""`). Assertion correctness unaffected. Optional fix: `.trim()` before split.
- Dead `claude/*` branches — prune pending.

### Audit findings (2026-06-27)

**Server-action contract drift**
- **N1** — Four duplicate `Result<T>` definitions; no shared `@/lib/result` type — PR7 (3.2.6 Pillar A)
- **N2** — Two auth helpers coexist (`requireUserId` throws / `getServerUser` redirects); split along legacy/3.2 boundary — PR7
- **N3** — `revalidatePath` cross-table gaps systematic across `createCase`, `deleteCase`, `updateCaseAgreedFee`, `createPayment`, `deletePayment`, `createCaseTask`, `toggleCaseTaskStatus`, `deleteCaseTask` — PR4
- **N4** — `taskActions.ts:56` `caseId as string` launders optional → string; runtime can write undefined cast to string — PR3
- **N5** — `try/catch` + `console.error` swallowing in `updateNote` (noteActions L274) and `updateCaseTask` (taskActions L365) inconsistent with 25 other actions; sentinel strings `"NOT_FOUND"` / `"INTERNAL_ERROR"` inconsistent with human-readable siblings — PR7

**RLS coverage**
- **N6** — User table zero verify-script coverage (critical given SECURITY DEFINER funcs touch it) — PR5
- **N7** — Document model zero verify-script coverage (orphan model, ships pre-data) — RLS hardening batch
- **N8** — INSERT WITH CHECK gap systematic on Case, Task, Note, CalendarEvent (only Payment verifies via phase52 verify) — RLS hardening batch
- **N9** — Note UPDATE + CalendarEvent UPDATE RLS uncovered (already in carry-forward as `verify-phase4-c1-update-rls.ts`) — RLS hardening batch

**Type-shape**
- **N10** — `gemini-adapter.ts:62` `Record<string, any>` — only `any` in entire codebase; LLM tool boundary — PR3 (fold with N26 Zod-per-tool)
- **N11** — Form-state → enum assertion cluster (9 hits across CaseDetailClient + CasesClient) — PR7 + post-3.2.6 component polish
- **N12** — String→number coercion cluster (FinancesClient L36/L43 + CaseDetailClient L140 — beyond SOT-listed L468) — PR7
- **N13** — `CasesClient.tsx:396` asserts schema-String field `caseType` as TS-enum — schema-cleanup pass (schema enum migration) + PR7

**Component shape**
- **N14** — CasesClient raw-Prisma debt (self-documents "3.3 will swap" TODO) — post-3.2.6 component polish (informal)
- **N15** — 5 captured-at-mount `useState(new Date())` cluster in CalendarClient + CaseDetailClient (pickerMonth state, not stale-now) — post-3.2.6 component polish
- **N16** — TasksClient re-derives server-computed Stats client-side; duplicate source of truth for optimistic UX — post-3.2.6 component polish
- **N17** — InboxClient drop handler stub `// Handle file drop logic here` — Phase 6 external (Document layer)
- **N18** — DashboardClient `now = new Date()` in fn body, re-evaluates every render; minor — post-3.2.6 component polish

**Auth boundary**
- **N19** — No `middleware.ts`; `auth.config.ts` `authorized()` callback is dead code with phantom matcher comment — PR1
- **N20** — `/sandbox` unprotected; reachable logged-out; renders auth-context-assuming chrome — PR1 (gate or strip)
- **N21** — `/api/voice/transcribe` returns 500 on unauth (`requireUserId` throws); `/api/chat` returns 401 JSON; semantic mismatch — PR1
- **N22** — No rate-limiting on `/api/voice/transcribe` or `/api/chat` (both spend Gemini credits) — Phase 9

**Voice + LLM**
- **N23** — `VoiceFAB.tsx` is UI-only stub; Send button has no onClick; floating mic globally visible but only `/chat` page wires real MediaRecorder. **DECISION: strip in PR2; rewire properly post-RAG in voice-polish phase** — PR2 + voice-polish
- **N24** — LLM tool surface uses LEGACY `taskActions` exclusively (raw-prisma 7); 3.2-compliant 5 not exposed; agent operates on pre-3.2 contract — PR3
- **N25** — `create_task` LLM tool hits N4 `caseId`-as-string bug — PR3
- **N26** — `executeTool` args mega-cast (`chat/route.ts` L334–350); no per-tool Zod validation; LLM wrong-shaped args silently undefined. **Promoted to internal pre-handoff per advisory decision** — PR3
- **N27** — Inconsistent Result-envelope checking in `executeTool` (`update_case_status` checks `result.ok`, `update_case_fee` doesn't) — Phase 6 external
- **N28** — `create_case` LLM tool spec doesn't accept `caseType`; defaults to `"OTHER"`; agent can't write Indian case types — PR3
- **N29** — Voice latency floor 4–30s from Gemini File API upload + polling — voice-polish phase
- **N30** — Transcription bypasses LLM provider abstraction; hardcoded `GoogleAIFileManager` + `gemini-2.5-flash` — Phase 6 external (RAG provider decision)
- **N31** — Document model zero LLM tool exposure — Phase 6 external

**Dep hygiene**
- **N32** — `next-auth` pinned to `5.0.0-beta.31` — pre-stable beta — Phase 9
- **N33** — `@types/bcryptjs` misplaced in `dependencies` (should be `devDependencies`) — PR6
- **N34** — `public/manifest.json` orphan (present but `next-pwa` not wired) — PR6 (couples to L6)

**Forbidden patterns / hygiene**
- **N35** — ~25 raw hex literals leak across components despite `@theme inline` sole-source. Sandbox worst offender (11+ hits). Exact-match drift: `#D4AF37` × 3 has token `--lawdger-gold`; `#f4efe8` × 2 has token `--primary-foreground` — PR6
- **N36** — `SettingsClient.tsx:192–194` comment claims token usage but next line uses raw `dark:bg-[#3A322C]` — PR6
- **N37** — `env.ts` validator coverage gap: `AUTH_SECRET`/`DATABASE_URL`/`DIRECT_URL` enforced at boot; `GOOGLE_API_KEY`/`LLM_*` only at first-call — Phase 9

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
| **4-B.3** | ✅ Done | **PR #20 (main @ `cdf0600`).** UI polish for auto-event pipeline. (a) `formatChipTime()` helper in CalendarClient — UTC-midnight detection → "All day" chip in Day + Month views; timed manual events unaffected. (b) Note-delete UI affordance in CaseDetailClient — hover trash icon + inline confirm overlay + `deleteNote` cascade wired; `errorMsg` banner on failure. (c) Next Date date hint — `nextDate` field added to `TimelineItem` note variant; renders `"Next Date · DD Mon YYYY"` or `"· date not set"` (muted) next to category badge. Storage stays UTC midnight — display-layer fix only. Carry-forward: (1) past-date warning banner deferred to global toast/notification phase; (2) `updateNote` + note-edit UI — standalone micro-PR; (3) 4-A.7 task-edit dialog — standalone post-B.3; (4) Day view all-day row — TIME_SLOTS 9AM–5PM hardcoded, all-day events invisible; fix in Calendar polish phase. |
| **4-C.1** | ✅ Done | **PR #21 (main @ `dcfb4f9`).** `updateNote` server action + note-edit modal. Zod + superRefine, owner-chain pre-flight, 8-row note↔event transition matrix (update/delete/create/no-op). Pencil affordance (hover, left of trash). No schema changes. Carry-forward: `verify-phase4-c1-update-rls.ts` (+3 assertions — next RLS batch); past-date warning banner (post-toast layer). |
| **4-A.7** | ✅ Done | **PR #22 (main @ `4421565`).** Task-edit modal in CaseDetailClient — Pencil affordance (hover, left of trash, mirrors 4-C.1). 4 editable fields: description, assignee, dueDate, isUrgent. `updateCaseTask` L362 revalidate patch (+`/cases/${caseId}`) — fixes stale SSR. Local Task type widened with assignee. Append-only on UI (create-task modal untouched). Carry-forward: assignee field in create-task modal (micro-PR); `verify-phase4-a7-update-task-rls.ts` (next RLS batch). |
| **5.1 (Dashboard real data)** | ✅ Done | **PR #23 (main @ `5c505df`).** All 4 dashboard tiles wired to real DB. IST timezone fix on `todayEvents` range. Mock fallbacks killed: `displayEvents` dummy (Today), Upcoming Dates dummy empty-state, Recent Documents hardcoded array (→ honest empty state, Phase 6 wires to real Document table), Active Cases hardcoded array (→ real `allCases` filtered `ACTIVE`, capped 3, "View all" → /cases). Next Up scoped to future-today events; "In Xm" chip via `formatDistanceToNow` (server-rendered, accepted stale-by-minutes tradeoff). `nextHearingDate` per case via `groupBy` on `CalendarEvent` (`Case.nextHearingDate` column is form-driven schema debt — see §10 Carry-forward). Date utils extraction: `endOfTodayIST` + `istDateKey` + `formatIndianDate` added to `src/lib/date.ts`, 3 consumers switched to shared import. |
| **5.2 (Finances)** | ✅ Recon | **Recon revealed no FinancesClient mock to kill — data pipeline already live.** Rescoped into 5.2a (P0 hardening) + 5.2b (polish). |
| **5.2a (Payment RLS verify + header bug)** | ✅ Done | **PR #24 (main @ `7ac0157`).** `verify-phase52-finances-rls.ts` (+5 Payment RLS assertions: SELECT iso + cross-user SELECT/UPDATE/DELETE fail-closed + INSERT mismatched-userId blocked by `WITH CHECK`). Header "Log Payment" button `disabled={cases.length === 0}` (was silently no-op when zero cases). Deferred to 5.2b: server-side aggregation, `formatINR` → `src/lib/format.ts`, `revalidatePath` on payment mutations, Zod on financeActions (or subsumed by 3.2.6). |
| **5.2b (Finances polish)** | ✅ Done | **PR #25 (main @ `082affb`).** Server-side aggregation in `getFinancesData` — returns `{ totals, forgottenDues, caseRows }` with per-row scalars, server-derived status (`FinanceStatus` union literal `"No Fee Set" \| "Paid" \| "Partial" \| "Unpaid"`), and fresh `Date.now()` per call (kills L28 `useState(() => Date.now())` captured-at-mount bug). `STAGNANT_DAYS = 60` hoisted to module const. `formatINR` extracted to `src/lib/format.ts` (third-consumer trigger fired); 4 call sites swapped (FinancesClient ×8, CaseDetailClient ×1, chat/route ×2). Single source of truth — `toLocaleString("en-IN")` exists only in `format.ts`. Existing `revalidatePath("/finances")` on all 3 mutators preserved. Zod / Result envelope / Payment.amount→paise / Payment.status enum deferred to 3.2.6 per scope discipline. All 5-step manual smoke walk PASS (fee edit `"No Fee Set"`→`"Unpaid"` / payment log → tiles `₹50k/₹20k/₹30k` + badge→`"Partial"` / 2nd payment → expand history sorted desc `[₹5,000, ₹20,000]` / forgotten-dues empty-state). Smoke 28/28 unchanged (no RLS surface touched). |
| PR1 | ⏸️ Next | Auth boundary cleanup (N19/N20/N21) — strip `authorized()` dead code, gate-or-strip `/sandbox`, fix transcribe 401 |
| PR2 | ⏸️ Sequenced | VoiceFAB strip (N23) — remove decorative FAB; voice lives on `/chat` only until rewire |
| PR3 | ⏸️ Sequenced | LLM tool migration + `executeTool` Zod (N4/N24/N25/N26/N28/N10) — migrate to 3.2 `taskActions`, fix `caseId` bug, Zod-per-tool, add `caseType` to `create_case` |
| PR4 | ⏸️ Sequenced | `revalidatePath` cross-table gap closure (N3) — invalidate downstream paths on mutations |
| PR5 | ⏸️ Sequenced | User RLS verify script (N6) — model on `verify-phase52-finances-rls.ts`; wire into `smoke:rls-runtime` |
| PR6 | ⏸️ Sequenced | Dep + token hygiene (L6/S2/N33/N34/N35/N36) — strip 4 unused deps, move `@types/bcryptjs`, replace exact-match raw hex |
| PR7 | ⏸️ Sequenced | 3.2.6 Pillar A — `financeActions`/`calendarActions`/`dashboardActions` contract uplift (L4/L9/S13/N1/N2/N5/N11/N12) — Zod + `Result<T>` + `revalidatePath` normalization; extract `@/lib/result` |
| PR8 | ⏸️ Sequenced | 3.2.6 Pillar B — `taskActions` legacy 7 + drag-drop restoration (L2/L3) — uplift remaining 7 actions, restore Kanban drag |
| Schema-cleanup pass | ⏸️ Sequenced | Enum migrations + `onDelete` cascades + Float→paise (L7/L8/S10/S12) — single migration window |
| RLS hardening batch | ⏸️ Sequenced | Document RLS, INSERT WITH CHECK on Case/Task/Note/CalendarEvent, Note+CalendarEvent UPDATE (N7/N8/N9) — post-PR5 |
| Voice infra polish | ⏸️ Sequenced (NEW PHASE) | Voice latency reduction + provider abstraction + global one-tap VoiceFAB rewire post-RAG (N29/N30 + future rewire) |
| Phase 6 — Legal Brain RAG | 🤝 External | N17/N27/N30/N31 + RAG architecture — Deferred to external dev. Baseline shipped via Phases 1–5.2b + internal queue PR1–PR8 + voice-polish + schema-cleanup + RLS hardening. Not in internal build queue. |
| Phase 7 — Notifications | ⏸️ Sequenced | Daily brief, task reminders, overlap alerts, payment alerts — post-RAG |
| Phase 9 — Vercel cutover | ⏸️ Sequenced | L1/L5/S1/N22/N32/N37 — DIRECT_URL fix, FORCE RLS posture on cloud, env validator extension, rate-limit, next-auth stable |

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