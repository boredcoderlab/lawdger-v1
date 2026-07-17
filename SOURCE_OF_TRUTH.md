# Lawdger — Source of Truth

**Last updated:** 2026-07-16 (post-W8 merge #43 — flip #10; N9/N65/N74/N82/N83 closed at 96067a5; same-day doc-hygiene fix — N66 reopened, W8 queue row flipped to Done format, surfaced at W9 CP-0)
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
- **Current main sha:** `eaa71d1` (#44 — W9 PR1 schema-safe combo squash-merge; last feature merge)
- **Last merge:** #44 W9 PR1 — Payment.status enum + FK-norm + N61 indexes (schema-safe combo) (`eaa71d1`)
- **W3 branch:** `w3-independent-task-llm-and-ui` MERGED via #40 (squashed to `09113dc`, branch deleted local + remote). Pre-merge tip was `7bab76d`.
- **PR8 branch:** `feat/pr8-tasks-uplift-pillar-b` MERGED via #39 (squashed to `0179f38`, branch deleted local + remote). Pre-merge HEAD was `dd96cad` (2-parent merge of `7c56610` + `a2785f1`).
- **W9 PR1 branch:** `feat/w9-pr1-schema-safe-combo` MERGED via #44 (squashed to `eaa71d1`). Pre-merge commit was `2073148`.

**§2 pointer-discipline note (2026-07-17, locked at W9 PR1 flip — the flip that founded this rule via N85):** Before committing any flip, plan-author diffs the flip commit's own §2 body against `git show <candidate-sha>:SOURCE_OF_TRUTH.md` to confirm §2's stated `Current main sha` / `Last merge` point at the actual most-recent feature-merge, not at a prior flip's target. Mandatory 2-command pre-commit check. Doc-hygiene commits on `main` (e.g. `e063130`) do NOT advance §2 pointers — only feature-merges do.

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

> **Status (Phase 3.0.1 closed — local runtime RLS enforced):** Local `DATABASE_URL` repointed to `lawdger_app` (NOBYPASSRLS). `smoke:rls-runtime` runs in **blocking mode** — **36/36 PASS** confirmed across **7 verify scripts** (count was 27/5, corrected to 23/5 at 4-A.7 CP-8 — prior 4-C.1 SOT flip incorrectly said 23/4; bumped to 28/6 at 5.2a with `verify-phase52-finances-rls.ts` +5 Payment assertions; that "28/6" figure was itself drift — actual pre-PR5 total was **32/6**; bumped to 36/7 at PR5 with `verify-user-rls.ts` +4 User assertions; see §7). Manual smoke 10/10 PASS. Vercel `DATABASE_URL` swap deferred to **Phase 9 (Platform + deploy)**.

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
   - `verify-phase32-rls.ts` (8 checks — Case isolation + updateCaseAgreedFee fail-closed, added W8)
   - `verify-with-user-context.ts` (5 checks — withUserContext)
   - `verify-phase4-rls.ts` (9 checks — Task isolation, added 4-A.3; check 7 added 4-A.4; checks 8 + 8b added for independent-task isolation)
   - `verify-pillar-b-rls.ts` (8 checks — CalendarEvent isolation + noteId fail-closed + cascade + past-date skip, added 4-B; updateCalendarEvent fail-closed, added W8)
   - `verify-phase52-finances-rls.ts` (5 checks — Payment isolation: SELECT iso + cross-user SELECT/UPDATE/DELETE fail-closed + INSERT mismatched-userId blocked by `WITH CHECK`, added 5.2a)
   - `verify-user-rls.ts` (4 checks — User isolation: self-select positive control + cross-tenant SELECT/UPDATE fail-closed + scoped-B state re-read, added PR5/N6)
   - `verify-phase4-c1-update-rls.ts` (4 checks — Note UPDATE + DELETE fail-closed, added W8)
   - `verify-phase4-a7-update-task-rls.ts` (3 checks — updateCaseTask fail-closed both OR-branches + positive-control survival, added W8)

   **Total: 50 RLS assertions across 9 scripts** (authoritative from `check-rls-runtime.ts` `TOTAL`-line output, W8 forward — the harness now aggregates each child's PASS/FAIL lines and prints an explicit `TOTAL: N assertions across M scripts`. The historical figures 23/27/28/32/36/38 were all manual hand-counts: pre-W8 the harness ran `stdio: "inherit"` and never aggregated child output, so the "authoritative from PASS-line count" claim was itself false — nothing was ever computed, every prior total was re-counted by hand and drifted repeatedly. N65 closed at W8 via the stdio pivot to `["inherit", "pipe", "inherit"]` + regex `/^(PASS|FAIL)\s/gm` count against the shared `record()` helper's uniform output). Per-script breakdown: verify-isolation 4, verify-phase32-rls 8, verify-with-user-context 5, verify-phase4-rls 9 (checks 1–8 + 8b), verify-pillar-b-rls 8, verify-phase52-finances-rls 5, verify-user-rls 4, verify-phase4-c1-update-rls 4 (NEW W8), verify-phase4-a7-update-task-rls 3 (NEW W8). W1 (#39) touched no verify scripts — count baseline held through merge. W3 (#40) likewise touched no verify scripts — count baseline held through merge (38/7 unchanged; independent-task LLM tool routing reused existing scoped actions, no new mutation surfaces). W5 (#41) touched no verify scripts — count baseline held through merge (38/7 unchanged; contract-3.2.6 uplift to calendarActions / dashboardActions / getFinancesData added Zod + Result<T> envelopes, no new mutation surfaces). W8 moved the baseline to 50/9 (+12 assertions: verify-phase4-c1-update-rls +4 updateNote/deleteNote, verify-phase4-a7-update-task-rls +3 updateCaseTask, verify-pillar-b-rls +3 updateCalendarEvent, verify-phase32-rls +2 updateCaseAgreedFee). W9 PR1 (#44) touched no verify scripts — count baseline held through merge (50/9 unchanged; schema-only PR: Payment.status enum, FK-norm on Note/CalendarEvent/Task→Case, 7 opportunistic indexes; recon §7 confirmed zero verify delta pre-execution). Standalone verify scripts use `getPrismaForUser` directly, not `getServerScopedPrisma` — no Next.js request context outside the app, and `getServerScopedPrisma` internally calls `getServerUser()` which depends on that context. Blocking mode — any FAIL exits 1. Assertion count is authoritative from `check-rls-runtime.ts` output, not from hand-count. **N65 closed at W8:** the harness now prints the authoritative total explicitly, eliminating this drift class.

**§7 addendum — RLS runtime harness statefulness (2026-07-12):** The runtime RLS harness is stateful — it seeds/mutates probe rows in the real DB. Back-to-back invocations of `npm run smoke` will spuriously fail with assertion-count drift (e.g. 29/6 instead of 38/7). Canonical gate = a single isolated invocation. If a re-run fails immediately after a green run, wait for seed teardown before treating it as a real regression.

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
- **New verify scripts must emit assertions via the shared `record(name, pass, detail)` helper's `PASS `/`FAIL ` prefix format** — the runtime counter's `/^(PASS|FAIL)\s/gm` regex aggregation in `check-rls-runtime.ts` depends on this uniform output. Deviation breaks the authoritative total.

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
| ~~`dnd-kit`~~ | Dropped in 4-A.2 TasksClient rewrite; deps removed @ `6a57fa4`. PR8 must `npm install` back if Kanban restoration needs it. |

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

## 10. Findings & Tech Debt

**Reconciliation pass 2026-06-27**: 4 existing entries (L7/L8/S2/S12) expanded to reflect full debt class scope. 37 new findings (N1–N37) catalogued in subsection below. Audit report: `/tmp/AUDIT_REPORT_2026-06-27.md` (Sahil's machine, not committed).

* Path correction (2026-07-14): Server actions live at `src/actions/*.ts`, NOT `src/lib/actions/*.ts` as some prior findings cited. All existing N-number references to `src/lib/actions/` should be read as `src/actions/`.
* Repo convention correction (2026-07-14): Closed sets in this repo are typed via const-asserted array + `(typeof X)[number]` derived union (see `CASE_TYPES` in `src/lib/case-constants.ts`, `ERROR_CODES` in `src/lib/result.ts` per W4). Prior notes describing this as a const-object pattern were incorrect.

### Larger debt (sequenced)

- **Runtime RLS enforcement: ✅ LIVE (local) — Vercel cutover deferred to Phase 9.**
- `taskActions` legacy half — own task ops (toggle/delete/create on bare `prisma`) still pre-3.2. `listAllTasks` 3.2-compliant additive shipped 4-A.2. Full contract uplift sequenced to **Phase 3.2.6**.
- Drag-drop between Kanban columns — dropped in 4-A.2. Restoration committed to **3.2.6 sprint**, bound to legacy `updateTaskAssignee` 3.2-compliant uplift.
- Contract uplift for `calendarActions` / `dashboardActions` / `financeActions` — currently scoped-only (3.2.5b-i), no Zod / no Result envelope. Sequenced to **Phase 3.2.6**.
- `connection_limit` in `DATABASE_URL` stays at `5` under `lawdger_app`. Monitor post-cutover; bump to `10` if Prisma P2024 returns.
- ~~`next-pwa` installed but unconfigured.~~ ✅ closed @ `6a57fa4` — stripped `next-pwa` entirely. Phase 9 revisits PWA with modern tooling if needed.
- **`Payment.amount` Float → Int paise + `Case.agreedFee` Float? → Int paise (sibling)** — destructive ×100 backfill, same migration window; both carry FP rounding risk. Resolve together in **schema-cleanup pass**.
- **String-as-enum migration — `Payment.status`, `Case.caseType`, `Note.category`, `Task.status`, `Document.status`** — free-text fields with no DB-level constraint. Sequenced to **schema-cleanup pass** (Prisma enums); contract-side enforcement covered by **3.2.6**.
- **`updateCaseAgreedFee` shape.** Uses `getServerScopedPrisma` + `updateMany` (fail-closed via where-clause, not owner-chain precheck). Functional but inconsistent with `withServerUserContext` + owner-check pattern used elsewhere. Uplift sequenced to **Phase 3.2.6**.

### Smaller debt — log + opportunistic

- **`.env.local` `DIRECT_URL` on pooler 6543** (Sahil's IPv4-only home network). Forces Supabase MCP detour for schema migrations. Fix at **P9 cutover** via Supabase IPv4 add-on or session-pooler endpoint.
- ~~**Unused runtime deps prune** — `@dnd-kit/{core,sortable,utilities}` + `next-pwa` — 4 deps with zero `src/` refs. Also `@types/bcryptjs` misplaced under `dependencies` (move to `devDependencies`).~~ ✅ closed @ `6a57fa4` — dep prune fully done. No remaining scope.
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
- **financeActions "PR7 done" is partial** — `getFinancesData` still bare `requireUserId` + throws (no Zod/Result envelope); only the three mutators are on-contract. Fold into **W5**.
- **SOT §7 assertion count drift (4th occurrence)** — ✅ closed at W8 via N65 — `check-rls-runtime.ts` now self-counts (stdio pivot + `/^(PASS|FAIL)\s/gm` aggregation + explicit `TOTAL` print); SOT §7 references the script output, hand-counting retired. See §7 note + N65.
- **Modal `caseId` defaults to `""` = independent task** on both /calendar and /tasks. Intentional post-W3 (independent tasks are first-class as of #37/#40). Not a bug, do not "fix."
- **Multi-file schema uplifts — tsc gate ordering.** The clean-tsc checkpoint belongs after the CONSUMER-file edit, not the schema-widen edit. A schema-widen commit in isolation cannot typecheck clean while narrow consumers still exist elsewhere in the tree.
- **Local `main` lags `origin/main` after a PR squash-merge on GitHub.** Squash rewrites history — a feature-branch working tree at its pre-merge tip is NOT the same commit as the merged `main`, even though file contents match. Always `git checkout main && git pull` before any post-merge verification, Chrome MCP matrix run, or SOT flip. Caught live during W3 CP-0 (local `main` was 1 commit stale, sitting on `w3-independent-task-llm-and-ui` at `7bab76d` instead of `main` at `09113dc`).
- **/tasks Orchestration sidebar lacks completed-state visual treatment** — no strikethrough/dim styling on completed tasks in the compact task-row list (underlying `status: completed` and the detail-modal "Mark Pending" toggle are both correct; this is UI-surface only). Found during W3 CP-2 verification. Bundle into **WS5** Kanban drag-drop work.
- **LLM tool confirmation asymmetry** — `delete_task` requires an explicit "yes" confirmation round-trip before executing; `create_task` and `update_task_status` execute on the first message with no confirmation step. Intentional destructive-op safety pattern (found during W3 CP-3 verification). Document, don't unify.
- **Verify-isolation exact-baseline test-data rule (2026-07-14)**: `verify-isolation.ts:84` hard-asserts B has exactly 2 cases, all B-prefixed. Chrome MCP verification steps that leave persistent rows in userB's account WILL break subsequent smoke runs. Any future browser-verification workstream must either (a) delete test artifacts via RLS-scoped guarded cleanup before final smoke, or (b) constrain test operations to accounts not covered by exact-baseline assertions. CP-8 in W4 combined tripped this; guarded cleanup script pattern (title+owner+ID match, aborts on mismatch) documented via CC memory `project-smoke-exact-baseline-testdata`.

### Audit findings (2026-06-27)

**Server-action contract drift**
- **N1** — Four duplicate `Result<T>` definitions; no shared `@/lib/result` type — PR7 (3.2.6 Pillar A)
- **N2** — Two auth helpers coexist (`requireUserId` throws / `getServerUser` redirects); split along legacy/3.2 boundary — PR7
- **N3** — ✅ closed @ `795e898`. `revalidatePath` cross-table gaps closed across 9 mutations (`createCase`, `updateCase`, `updateCaseStatus`/`archiveCase`, `deleteCase`, `createCaseTask`, `toggleCaseTaskStatus`, `deleteCaseTask`, `updateCaseTask`, `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`, `updateCaseAgreedFee`) with 29 revalidatePath additions across 4 action files. Wildcard `/cases/[id]` syntax used for consistency. Original finding cited `createPayment`/`deletePayment` as gappy — recon confirmed hypothetical, not real gaps under current data model (Payment only read on `/finances` which is already revalidated), so those two remain untouched. Legacy taskActions (`createTask`, `updateTask`, `updateTaskStatus`, `updateTaskAssignee`, `deleteTask`) NOT touched in PR4 — non-functional under RLS (N38/N39), revalidate fix moot until PR8 restores functionality.
- **N4** — ✅ closed @ db48bb9 (PR3). LLM-boundary zod requires `caseId` on `create_task`; legacy `taskActions.ts:56` cast untouched, cleanup deferred to schema-cleanup pass.
- **N5 (P3)** — try/catch inconsistency at `taskActions.updateCaseTask` (L502 `"Failed to update task"`) + `noteActions.updateNote` (L273 `"Update failed"`). Both wrap the transaction in a top-level try/catch that swallows unexpected DB errors into a generic system-category string, while other action functions let unexpected errors propagate per the documented file-header envelope contract. Prior wording cited sentinel strings (`"NOT_FOUND"`/`"INTERNAL_ERROR"`) — those strings no longer exist in current code (W5 refactor); the structural inconsistency remains. W5.1 architectural stress-test (Opus 4.7, not Fable) rejected Option 3 (throw-based taxonomy) which would have subsumed N5, on Next.js server-action redaction grounds. Deferred to a later WS.

**RLS coverage**
- **N6** — ✅ closed @ `e387450`. User table zero verify-script coverage (critical given SECURITY DEFINER funcs touch it). `verify-user-rls.ts` added (+4 assertions: self-select positive control, cross-tenant SELECT/UPDATE fail-closed, scoped-B state re-read). INSERT/DELETE probes and action-layer read-modify-write explicitly out of scope (no policies/code paths exist; redundant with `verify-with-user-context.ts`).
- **N7** — Document model zero verify-script coverage (orphan model, ships pre-data) — RLS hardening batch
- **N8** — INSERT WITH CHECK gap systematic on Case, Task, Note, CalendarEvent (only Payment verifies via phase52 verify) — RLS hardening batch
- **N9** — ✅ closed at W8. Note UPDATE + CalendarEvent UPDATE RLS uncovered (was in carry-forward as `verify-phase4-c1-update-rls.ts`). Closed W8: `verify-phase4-c1-update-rls.ts` covers Note UPDATE (updateNote ×3) + DELETE (deleteNote ×1, see N82); `verify-pillar-b-rls.ts` extension covers CalendarEvent UPDATE (updateCalendarEvent ×3).

**Type-shape**
- **N10** — ✅ closed @ db48bb9 (PR3). `gemini-adapter.ts:62` `Record<string, any>` → `Record<string, unknown>`.
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
- **N19** — No `middleware.ts`; `auth.config.ts` `authorized()` callback is dead code with phantom matcher comment — ✅ PR #26 @ 12bbc3a
- **N20** — `/sandbox` unprotected; reachable logged-out; renders auth-context-assuming chrome — ✅ PR #26 @ 12bbc3a
- **N21** — `/api/voice/transcribe` returns 500 on unauth (`requireUserId` throws); `/api/chat` returns 401 JSON; semantic mismatch — ✅ PR #26 @ 12bbc3a
- **N22** — No rate-limiting on `/api/voice/transcribe` or `/api/chat` (both spend Gemini credits) — Phase 9

**Voice + LLM**
- **N23** — `VoiceFAB.tsx` is UI-only stub; Send button has no onClick; floating mic globally visible but only `/chat` page wires real MediaRecorder. **DECISION: strip in PR2; rewire properly post-RAG in voice-polish phase** — ✅ PR #27 @ 8edef7e — VoiceFAB.tsx deleted, LayoutShell.tsx cleaned (usePathname + showFAB + mount removed)
- **N24a** — ✅ closed @ db48bb9 (PR3). 4 task tools re-pointed to 3.2 siblings: `get_tasks`→`listAllTasks`, `create_task`→`createCaseTask`, `update_task_status`→`toggleCaseTaskStatus` (read-then-toggle adapter), `delete_task`→`deleteCaseTask`.
- **N24b** — OPEN. Sequenced to PR8 (3.2.6 Pillar B). `update_task` stays on legacy `updateTask` with zod at LLM boundary. `updateCaseTask` needs partial-update surface (currently all 5 fields mandatory) before LLM tool can migrate.
- **N25** — ✅ closed @ db48bb9 (PR3). `create_task` tool spec `caseId` required + routes to `createCaseTask`.
- **N26** — ✅ closed @ db48bb9 (PR3). Per-tool zod `safeParse` in `src/lib/llm/tools/dispatch.ts`; mega-cast deleted.
- **N27** — ✅ closed pre-Fable at `dispatch.ts:282-283` (already checks `result.ok`). SOT drift — surfaced by Fable 5 audit, not by execution.
- **N28** — ✅ closed @ db48bb9 (PR3). `create_case` tool spec adds `caseType` enum from `CASE_TYPES`; hardcoded `"OTHER"` removed.
- **N29** — Voice latency floor 4–30s from Gemini File API upload + polling — voice-polish phase
- **N30** — Transcription bypasses LLM provider abstraction; hardcoded `GoogleAIFileManager` + `gemini-2.5-flash` — Phase 6 external (RAG provider decision)
- **N31** — Document model zero LLM tool exposure — Phase 6 external

**Dep hygiene**
- **N32** — `next-auth` pinned to `5.0.0-beta.31` — pre-stable beta — Phase 9
- **N33** — ✅ closed @ `6a57fa4`. `@types/bcryptjs` moved `dependencies` → `devDependencies`.
- **N34** — ✅ closed @ `6a57fa4`. `public/manifest.json` deleted + dangling `<link rel="manifest">` removed from `src/app/layout.tsx:36`. Amendment: file was linked from `layout.tsx:36`, not truly orphan as originally catalogued — recon-time scope expansion included the `<link rel="manifest">` removal.

**Forbidden patterns / hygiene**
- **N35** — OPEN. ~16 raw hex literals leak across components despite `@theme inline` sole-source (shrunk from ~25 post-sandbox deletion in PR1; current worst offender `ui/LayoutShell.tsx`, 8 hits). Exact-match drift: `#D4AF37` × 3 has token `--lawdger-gold`; `#f4efe8` × 2 has token `--primary-foreground` — PR6b
- **N36** — OPEN. `SettingsClient.tsx:192–194` comment claims token usage but next line uses raw `dark:bg-[#3A322C]` — PR6b (folded into N35 sweep)
- **N37** — `env.ts` validator coverage gap: `AUTH_SECRET`/`DATABASE_URL`/`DIRECT_URL` enforced at boot; `GOOGLE_API_KEY`/`LLM_*` only at first-call — Phase 9
- **N38** — ✅ closed @ `3bc3742` (#37). Legacy `updateTask` (`taskActions.ts:91`) non-functional under runtime RLS. Uses bare `prisma.task.updateMany` without `withServerUserContext`/`getServerScopedPrisma`. `lawdger_app` role (NOBYPASSRLS, FORCE RLS) blocks the write → `result.count=0` → throws `"Unauthorized"`. Pre-existing bug exposed by PR3 direct dispatcher diagnostic. Until fix: agent calls to `update_task` failed with `"Unauthorized"` error message (clean error, not silent failure). All other LLM tools unaffected. **Resolution:** closed by Independent Tasks PR (nullable-caseId path), not PR8/WS1 as originally scoped.
- **N39** — ✅ closed @ `3bc3742` (#37). `CalendarClient.tsx` imports and calls legacy `createTask`/`updateTask`/`deleteTask` from `taskActions.ts`. Under runtime RLS (`lawdger_app`, FORCE RLS, no GUC), all three broken: INSERT policy blocks `createTask`, UPDATE/DELETE return count=0. Task create/edit/delete from Calendar page silently non-functional. Extension of N38 pattern to Calendar surface. P1 user-visible breakage. Surfaced during PR4 recon. **Resolution:** closed by Independent Tasks PR (#37, `3bc3742`); CalendarClient callers now uplifted.
- **N40** — ✅ closed @ `4d815dd`. `verify-isolation.ts` check 1 hardcoded `aCases.length === 2` and `title.startsWith("A-")` assertions incompatible with shared dev-account test user pattern (userA = `jainsahil2897@gmail.com` doubles as manual /chat walk user; real cases pollute count + title baseline). RLS itself sound — checks 2/3/4 continued to pass and validate fail-closed cross-tenant behavior. Fix: dropped count and title-prefix constraints, kept structural ownership check (`length > 0` + `every(c => c.userId === userA.id)`) matching sibling `verify-with-user-context.ts` pattern. User B check (check 2) intentionally left strict — `userb@test.local` is dedicated stable test user.
- **N41** — `postcss <8.5.10` moderate (GHSA-qx2v-qp2m-jg93 — XSS via Unescaped `</style>` in CSS Stringify Output) transitive inside `node_modules/next/node_modules/postcss`. Not the project's own postcss devDependency. Unaffected by next 16.2.10 bump — bundled inside Next's own dependency tree. Only npm-suggested fix is `next@9.3.3` downgrade (nonsensical, forbidden). Awaits upstream Vercel postcss bump. Track, do not force-fix.

**Post-PR7 cleanup (2026-07-05)**
- **N42** — ✅ closed @ `37292f7` (#35). Every id-shaped Zod validator in the actions layer used `z.string().min(1)` with a custom "required"-style message. Every model uses `@default(uuid())`, so the check only ever caught an empty string, never an invalid-uuid string. `financeActions.ts` set the stricter `z.string().uuid()` convention in PR7; this aligned the rest — 11 fields across `caseActions.ts` (`idSchema`), `noteActions.ts` (5 fields), `taskActions.ts` (5 fields).
- **N43** — ✅ closed @ `4e009c2` (#36). `dashboardActions.ts` `getDashboardData` re-derived `Case.nextHearingDate` per request via `groupBy` on `CalendarEvent` — redundant DB round-trip once PR7 (`5974272`) made `Case.nextHearingDate` a synced cache column (`src/lib/calendar-sync.ts`, wired into all `CalendarEvent` mutations). Replaced with direct `nextHearingDate: true` select + stale-past filter (cache is only re-synced on calendar mutations, so its value can lag into the past between them). Not in scope: `CasesClient.formatHearing` and `CaseDetailClient` surface the same cache column without the stale-past filter — same root cause, different files, carried forward.

**Post-Independent-Tasks merge (2026-07-09)**
- **N44** — ✅ closed @ `3bc3742` (#37). Calendar "Independent Task" UI option (`CalendarClient.tsx`) presented `<option value="">` while `Task.caseId` was `String` NOT NULL at schema level — pre-PR#37 this either silently failed at DB level (`createTask` lie-cast bug) or surfaced a clean Zod error banner (post-WS1 on the other branch). Resolved via PR #37 — `Task.caseId` migrated to `String?`, Independent Tasks now a real supported feature. Product decision: Lawdger supports standalone tasks alongside case-linked tasks.
- **N45** — ✅ closed @ `3bc3742` (#37). LLM `update_task` tool's `caseId: null` unlink path relied on the same NOT NULL constraint mismatch — WS1's wrapper (on `feat/pr8-tasks-uplift-pillar-b`) coalesced `null` to `undefined` as a workaround, silently no-op'ing unlink attempts. Resolved via PR #37's schema migration — `null` now writes through legitimately at the DB level. Note: the `dispatch.ts` LLM tool routing itself lives on `feat/pr8-tasks-uplift-pillar-b` (WS3) and will need reconciliation with this fix during PR8's rebase onto main.
- **N46** — ✅ closed @ `3bc3742` (#37, commit `59ce3ed`). `getTasksWithDueDate` (feeds `/calendar`'s task list) was bare-Prisma + `requireUserId` with no GUC, silently blocked by FORCE ROW SECURITY on `Task` (42501, since `phase_3_0_1a` / June 13). Calendar had shown ZERO tasks to every user for ~4 weeks. Discovered incidentally during PR #37's manual walk (chip-click requirement surfaced it). Uplifted to `withServerUserContext` + `Result<T>` contract.
- **N47** — OPEN. `prisma/seed.ts` is bare-Prisma against `prisma.user.upsert`, blocked by FORCE ROW SECURITY on `User` table. Discovered during PR #37 (seed fixture "A-Independent-Task"/"B-Independent-Task" never materialized — seed script likely failing silently on every fresh reset since `User` RLS went FORCE). NOT fixed — needs own PR. Sequenced: next available slot, high priority given blast radius (affects all fresh-seed dev setups).

**Systematic bare-Prisma-under-FORCE-RLS audit needed** — N38, N46, N47 are three independent instances of the same failure class (bare `prisma` client used against a FORCE ROW SECURITY table, silently failing or returning empty results with no GUC set). All three were found incidentally, not via systematic search. Recommend a dedicated read-only recon pass — grep all `actions/*.ts` + `scripts/*.ts` for bare `prisma.<model>.` calls (not `tx.`, not scoped `db.`) cross-referenced against which tables have `FORCE ROW SECURITY` — before the RLS hardening batch phase, to surface any remaining instances proactively rather than by accident.

**Fable 5 full-codebase audit (2026-07-10)**
- **N48 (P1)** — ✅ closed @ `0179f38` (#39, W1). Independent-task edit broken on main. TasksClient.tsx:326 routes edits through `updateCaseTask`, owner-check joins `case:{userId}` — null-case tasks never match → error banner "Task not found or not yours" + edit impossible (severity amended from Fable's original "silent rollback" wording — error banner shows, but edit blocked). Fable W1 stress-test confirmed PR8 WS2's partial-update surface covered field semantics only, NOT the owner-check path (see N70). W1 executed the fix server-side: broadened `updateCaseTask` where-clause to `OR: [{ case: { userId } }, { userId, caseId: null }]`, plus null-guarded `revalidatePath` on non-null `caseId`. Certified FAIL→PASS at W1 CP-8 matrix cell [3] (independent task edit via /tasks board succeeds post-W1).
- **N49 (P1)** — ✅ closed @ `1c49346` (#38). Today's all-day hearing vanishes at 05:30 IST from all "next hearing" surfaces. Storage UTC-midnight; 4 sites compared against `new Date()` instead of an IST-today floor. Closed via IST-today floor at 4 sites: `isFutureIST()` in CaseDetailClient (sidebar) and DashboardClient (hero card); `filterStalePastHearing`/`stripStalePastHearing` (both wrap `startOfTodayIST()`) in dashboardActions/listCases/getCaseWithChildren; `startOfTodayIST()` inline in `calendar-sync.ts` writer that populates the `Case.nextHearingDate` cache column.
- **N50 (P1)** — ✅ closed @ `5a57c2c` (#42, W4 combined). CaseDetailClient fire-and-forget mutation calls (updateCase, updateCaseStatus, createCaseTask, docket toggle+delete). Result envelope not checked. User sees success UI, data unsaved on Zod rejection. Resolution: W4 combined (PR #42, 5a57c2c) — `.ok` gates + per-context errorMsg state (saveError/taskError/noteError/docketError) wired across `updateCase` (L151), `updateCaseStatus` (L157), `createCaseTask` (L200), `createNote` (L346 `handleAddNote` — also closes N78), docket toggle+delete (L363/369/821). CLOSED.
- **N51 (P2)** — ✅ closed @ `5a57c2c` (#42, W4 combined) — client half; server half closed @ `4f7a8c3` (#41, W5). CalendarClient hearing ops have no failure path at all: createCalendarEvent/updateCalendarEvent/deleteCalendarEvent throw (no Result), callers don't catch → unhandled rejection, button stuck "Saving…", drag-drop reschedule silently lost on error. Evidence: CalendarClient.tsx:261–265, 276, 288; root cause calendarActions.ts (no Zod/Result — known 3.2.6 debt, client half uncatalogued). Fix direction: W5 uplift + client result.ok handling. Resolution: W4 (client half) / W5 (server half). **W5 W5.4 (WS-B) commit 93704ce**: calendarActions Zod + Result<T> uplift; throws replaced with Result envelopes; client-side .ok wiring on CalendarClient.tsx:261–265, 276, 288 remains W4 scope (unblocked by W5). **W4 combined (2026-07-14)**: client-side `.ok` gates wired at CalendarClient.tsx L261 (save handler), L271 (create/update), L279/L282 (delete), L302 (drag-drop reschedule); local events mirror (~L168) + useEffect prop-resync (~L169) added so drag-drop can apply an optimistic move and roll back; handleDrop (~L291–303) snapshots `events` before mutation and restores it on `!result.ok`, surfacing `errorMsg`. N51 fully closed.
- **N52 (P2)** — ✅ closed @ `4f7a8c3` (#41, W5). Pages violate the repo's own parallel-scoped-ops BAN: Promise.all over 3 (calendar) / 2 (cases) scoped actions, each opening its own GUC transaction — the exact P2024 shape prisma-rls.ts:18–26 bans. Latent pool-exhaustion under concurrent users at connection_limit=5. Evidence: calendar/page.tsx:6–10, cases/page.tsx:5–8. Fix direction: Sequential awaits, or one withServerUserContext loader per page. Resolution: W5. **W5 W5.7 (WS-E) commit d88c1f3**: calendar/page.tsx + cases/page.tsx sequential awaits (path a per recon CP-4), preserved action signatures. Concurrent scoped-tx pattern eliminated at both loaders.
- **N53 (P2)** — ✅ closed @ `0179f38` (#39, W1). getTasks + updateTaskAssignee: last two bare-Prisma functions, both dead code (zero callers). Original handoff wording claimed WS1 deleted both — INCORRECT: WS1 deleted `getTasks` but UPLIFTED `updateTaskAssignee` to full Contract 3.2 (Zod + withServerUserContext + Result envelope). W1 Decision A locked: keep PR8's uplifted version (RLS-safe, 0 callers, preserves optionality). See N71 for full Decision A rationale.
- **N54 (P2)** — ✅ closed @ `09113dc` (#40, W3). LLM tools couldn't touch independent tasks: create_task required caseId, update_task_status/delete_task required caseId and routed to case-task actions; dispatch pre-read filtered { id, caseId }. Only update_task had the hybrid treatment (on the PR8 branch, not main). Resolution: create_task/update_task_status/delete_task extended to hybrid-dispatch — null caseId routes to independent-task actions (createTask/updateTaskStatus/deleteTask), UUID caseId routes to case-linked adapters. Verified end-to-end via Chrome MCP matrix (CP-1/CP-2/CP-3, all PASS): LLM create/complete/delete of an independent task via /chat, confirmed against /tasks board state each step.
- **N55 (P2)** — ✅ closed @ `09113dc` (#40, W3). /tasks create modal required a case (canSubmit gated on caseId !== ""); independent tasks creatable only via the Calendar modal. Feature shipped in #37 was undiscoverable on its home page. Resolution: "— No Case (Independent Task)" option added to /tasks modal (mirrors CalendarClient pattern), canSubmit gate dropped, handleCreate branches on caseId="" → createTask call, isUrgent checkbox conditionally rendered only when caseId !== "". Verified via Chrome MCP matrix (CP-4, all sub-checks PASS): default option text verbatim + "Case (optional)" label, isUrgent hide/show/reset across selection changes, task creation with no case link, cleanup delete.
- **N56 (P2)** — UI asserts "End-to-End Encrypted Workspace" — false: server-side AI processing; voice audio is written to server tmpdir and uploaded to Gemini File API. SOT §11 flags the pitch-deck claim; the in-app badge was uncatalogued. For a legal-confidentiality product this is a liability, not copy polish. Evidence: SettingsClient.tsx:235; supporting: transcribe/route.ts:43–51. Fix direction: Rescope to "Encrypted in transit & at rest"; pair with Gemini-retention verification. Resolution: W10.
- **N57 (P2)** — ✅ closed @ `4f7a8c3` (#41, W5). Signup accepts a 1-character password: createAccount has no Zod, no strength rule, no email-format check — while changePassword enforces min 8. Weakest link is account creation. Evidence: signup/actions.ts:33–44 vs settingsActions.ts:264–266. Fix direction: Zod schema mirroring changePasswordSchema (min 8) + z.string().email(). Resolution: W5. **W5 W5.3 (WS-I) commit d5f5c4f**: createAccountSchema mirrors changePasswordSchema (min-8 password, z.string().email(), name required, .refine password match). Chrome MCP: server Zod rejects 3-char password + malformed email; client HTML5 layer independently blocks (defense-in-depth confirmed).
- **N58 (P2)** — ✅ closed @ `4f7a8c3` (#41, W5). createPayment status is free-text on money rows: z.string().optional(). Anything other than "paid" is excluded from received totals (financeActions.ts:67) — a typo'd status silently understates collections. LLM boundary restricts to the enum; direct action callers aren't. Evidence: financeActions.ts:167. Fix direction: z.enum(["paid","pending"]) now; DB enum in schema-cleanup pass. Resolution: W5. **W5 W5.2 (WS-J) commit d5a5466**: status z.enum(["paid","pending"]).optional(). LLM boundary already schema-restricted; direct-action callers now enum-narrowed. DB enum deferred to W9 schema-cleanup pass.
- **N59 (P2)** — deleteCase cascade is (a) non-atomic — 5 sequential deleteMany on the per-op scoped client, mid-flight failure orphans children; (b) misses Document — first uploaded document makes its case undeletable (FK Restrict), and with (a) the failure strikes after tasks/notes/events are already gone. Latent until Document upload ships, then immediate. Evidence: caseActions.ts:369–375; schema relation schema.prisma:65, 139. Fix direction: Wrap in withServerUserContext, add document.deleteMany; superseded by onDelete: Cascade. Resolution: W9.
- **N60 (P3)** — ✅ closed @ `4f7a8c3` (#41, W5). Hearing edits can't clear title/description: ...(data.title && …) truthiness drops empty strings, and the client pre-launders with || undefined. Deleting notes text → save → old text persists. Evidence: calendarActions.ts:79–81, CalendarClient.tsx:262. Fix direction: !== undefined checks + explicit null-to-clear in the Zod schema. Resolution: W5. **W5 W5.4 (WS-B + WS-M) commit 93704ce**: server-side title/description !== undefined truthiness fix (calendarActions.ts) + client-side || undefined removal (CalendarClient.tsx:262,264). Chrome MCP: cleared Notes → save → hard reload → Notes empty on reopen (was persisting pre-W5). N60 verified end-to-end.
- **N61 (P3)** — No indexes on Note / Task / CalendarEvent / Payment — no @@index on userId/caseId/dueDate/hearingDate anywhere on the four hottest tables; every RLS-filtered list is a seq scan. Only Case and Document carry indexes. Evidence: schema.prisma:73–127 (absence) vs :69–70, 143–144. Fix direction: @@index([userId]), @@index([caseId]), plus Task([userId, status]), CalendarEvent([userId, hearingDate]) in the schema-cleanup migration window. Resolution: W9.
- **N62 (P3)** — ✅ closed @ `4f7a8c3` (#41, W5). Non-null assertion t.dueDate! — safe only via a query invariant (dueDate: { not: null }) living in a different file; exactly the pattern the nullable-caseId era makes dangerous. Evidence: calendar/page.tsx:24. Fix direction: Narrow the return type in getTasksWithDueDate instead. Resolution: W5. **W5 W5.7 (WS-K) commit d88c1f3**: TaskWithDueDateRow.dueDate narrowed Date | null → Date; `!` assertion moved from calendar/page.tsx into taskActions.ts adjacent to the dueDate: { not: null } filter invariant. Prisma's select isn't filter-aware, so the assertion lives with its guarantee. Consumer .map() left as identity transform (preserves explicit shape hint; cosmetic drop deferred).
- **N63 (P3)** — Month-view drag-drop wipes a timed hearing to midnight: handleDrop without targetTime sets hearingDate = targetDay (00:00) — a 2 PM hearing dragged across days becomes "All day". Evidence: CalendarClient.tsx:284–290, 621. Fix direction: Preserve source event's time-of-day on date-only drops. Resolution: **split out of W6 into W6b** — W6's actual scope (N49/N67/N68) landed without touching drag-drop; N63 was never in W6's diff.
- **N64 (P3)** — ✅ closed @ `4f7a8c3` (#41, W5). Load-bearing comments lie about security posture (pre-FORCE-RLS era): "User has no RLS", "Until 3.0.1's FORCE RLS lands", "three verify scripts". Next engineer trusting them re-introduces the N38 class. Evidence: session.ts:24–25, settingsActions.ts:17–19, 29–33, check-rls-runtime.ts:14–22. Fix direction: Comment sweep. Resolution: W5. **W5 W5.8 (WS-L) commit 8a32625**: session.ts / settingsActions.ts / check-rls-runtime.ts pre-FORCE-RLS comment sweep. Repo-truth grounded: FORCE RLS live per 3.0.1a migration L229, User RLS per 3.2.5a, runtime lawdger_app NOBYPASSRLS role, VERIFY_SCRIPTS = 7 entries. check-rls-runtime.ts L6–9 advisory branch left untouched (conditional documentation of existing code, not a stale claim).
- **N65 (P3)** — ✅ closed at W8. SOT §7 assertion count stale again (36 → ≥37 post-#37, verify-phase4-rls.ts Check 8). Fourth drift of this counter — and W8 recon surfaced the root cause: the harness ran `stdio: "inherit"` and never actually computed any total, so every historical figure (23/27/28/32/36/38) was a manual hand-count, not a script output. Evidence: verify-phase4-rls.ts:216; SOT §7. Closed W8: `check-rls-runtime.ts` stdio pivot to `["inherit", "pipe", "inherit"]` + regex `/^(PASS|FAIL)\s/gm` aggregation + explicit `TOTAL` print; §7 body truth-corrected; §8 workflow rule added mandating the `record()` PASS/FAIL prefix format.
- **N66 (P3)** — OPEN (reopened 2026-07-16). Sidebar note composer hardcodes category: "General Note" — "Next Date" notes (the auto-event trigger, P4's cornerstone) are unreachable from the case page UI; only chat or edit-after-create. RECON §3e observed this; it never got an N-number. Evidence: CaseDetailClient.tsx:323. Fix direction: Category select in composer (edit modal at L1230 already has one to copy). W4 closed silent-failure wiring (`.ok` gate + `noteError` banner) inside same `handleAddNote` — category hardcode itself was never touched. Verified 2026-07-16 at W9 CP-0: `CaseDetailClient.tsx` L346 still hardcodes `category: "General Note"`; L525–550 sidebar composer has no category selector. Reopened. Resolution: pending separate micro-PR.
- **N67 (P3)** — ✅ closed @ `1c49346` (#38). nextHearingDate cache rendered with time — all-day cache values display "12:00 am"; and CasesClient.formatHearing + CaseDetail sidebar lack the stale-past filter dashboard got in N43 (known carry-forward, now with the N49 twist). Evidence: DashboardClient.tsx:267, CasesClient.tsx:66, 430. Closed via server-side `filterStalePastHearing`/`stripStalePastHearing` at listCases/getCaseWithChildren, and `formatNextHearing` with `isAllDayIST` detector in DashboardClient. **Amendment:** initial commit `1970fb5` used broken `getUTCHours()===0` check (matches UTC midnight = 05:30 IST, not IST midnight); corrected in amendment `ce16709` via `isAllDayIST` Intl formatter helper in `src/lib/date.ts`.
- **N68 (P2)** — ✅ closed @ `1c49346` (#38). CaseDetailClient `MatterDetails` block (`CaseDetailClient.tsx:1398`) had `hasAny` guard excluding `matterType` — when `nextHearingDate` was the only truthy field and got nulled by W6's `stripStalePastHearing`, the entire Matter Details block (including `Matter: Litigation`) vanished from the sidebar. Latent pre-W6, unmasked by W6's cache-null write. Fix: added `matterType` to the `hasAny` clause. Silent-on-null per-row pattern preserved for the individual `Next Hearing` `DetailLine` (consistent with the other 7 optional fields in the same block — no separate fallback text added).

**Bare-Prisma-under-FORCE-RLS bug class: EXHAUSTED.** Fable 5 systematically grepped every `prisma.<model>.` call in app code cross-referenced against FORCE RLS tables. Population = N38 + N46 + N47 + `getTasks` + `updateTaskAssignee` (both dead — `getTasks` deleted in PR8 WS1, `updateTaskAssignee` kept per W1 Decision A, still 0 callers). No further instances hiding.

**W1 Fable stress-test + recon + execution (2026-07-11)**
- **N69 (P0)** — ✅ closed @ `0179f38` (#39, W1). CalendarClient merge conflict hunks 1–2 (handleSave task branch) would have regressed Independent Tasks at its only entry point if resolved to PR8 side. PR8's side hard-blocked with "A case is required for tasks" guard; main's side (post-#37) permitted `caseIdVal = form.caseId || null`. Resolution: MAP-1 pick main on all 3 hunks. Certified at W1 CP-8 matrix cells [1], [2], [4] (independent-task create/edit/delete via Calendar modal all pass).
- **N70 (P0)** — ✅ closed @ `0179f38` (#39, W1, FIX-1). WS2's partial-update surface fixed field semantics only, NOT the owner-check path. PR8 HEAD `updateCaseTask` retained `case:{userId}` join owner-check unchanged from base. W1 FIX-1 added: (a) owner-check `where`-clause broadened to `OR: [{ case: { userId } }, { userId, caseId: null }]` (Task.userId is direct schema field, works for independent tasks), (b) `revalidatePath(\`/cases/${updated.caseId}\`)` guarded behind non-null caseId (prevents `/cases/null` emission on independent-task edits). Verified in-code at W1 CP-3 (grep counts) and at runtime via CP-8 cell [3] (N48/N70 certification) + cell [4] server log (`grep -i 'cases/null' .next/dev/logs/next-development.log` empty). Consolidates N48.
- **N71 (P1)** — ✅ closed @ `0179f38` (#39, W1, Decision A). PR8 WS1 uplifted `updateTaskAssignee` (Zod + withServerUserContext + Result envelope), did NOT delete it — original SOT N53 handoff wording was wrong. W1 Decision A: keep PR8's uplifted version (0 callers on both sides, inert but RLS-safe; preserves optionality for potential WS5 assignee-drag use). Main's bare-Prisma variant (last bare-Prisma fn in module, N38 trap class) overwritten. `getTasks` still deleted per WS1 as originally scoped. SOT N53 wording corrected via this flip.
- **N72 (P1)** — ✅ closed @ `0179f38` (#39, W1, MAP-3 + COMMENT-1/COMMENT-2). Null-caseId semantic flip in `dispatch.ts` `update_task` case: main's preferred `updateTask` genuinely writes null (unlinks task from case) per #37; PR8's stale comments claimed `null → squashed to undefined → silent no-op` and `Task.caseId is NOT NULL in schema, so may never trigger`. Both comments factually false post-merge. W1 resolved to PR8 side (hybrid dispatcher — strictly more capable than main's trivial unwrap) + rewrote both comments to reflect nullable-caseId reality (Independent Tasks migration reference). Behavior-change certified at CP-8 matrix cells [13] (unlink: UUID→null real write) and [14] (move: null→UUID). LLM tool schema (`schemas.ts`) already allowed nullable caseId on both refs — no schema change needed.
- **N73 (P1)** — ✅ closed @ `0179f38` (#39, W1, MAP-2 whole-function granularity). taskActions.ts type-block picks required explicit resolution: `TaskRow` → main (nullable variant), `updateCaseTaskSchema` + `UpdateCaseTaskInput` → PR8 (partial-update WS2). Whole-function reconstruction methodology (not marker-walk) required because PR8's deletions + reorderings caused 10 raw hunks to interleave fragments of 6 different functions. Wrong picks would have failed `smoke:tsc` (structural type mismatches with Prisma-derived nullable `caseId`) — safety net confirmed in CP-4 recon. Module header amended: PR8's stale "Task.caseId is NOT NULL" paragraph struck, replacement paragraph documents nullable-since-#37 dual-path routing.
- **N74 (P2)** — ✅ closed at W8. `npm run smoke` chain (tsc + prisma validate + check-rls + check-rls-runtime) does NOT exercise task CRUD functional paths. `verify-phase4-rls.ts` (which has independent-task isolation coverage 8/8b) is IN the runtime chain, but not the standalone check for N48/N70-class semantic regressions. W1 mitigated via manual matrix at CP-8 (14/14 executable cells). Closed W8: added `verify-phase4-c1-update-rls.ts` (updateNote ×3 + deleteNote ×1) + `verify-phase4-a7-update-task-rls.ts` (updateCaseTask — both OR-clause branches, case-linked + independent, plus positive-control survival).
- **N75 (P3, informational)** — updateTaskStatus survival mechanics locked. Sole caller = main `TasksClient.tsx:33/:206` (file auto-merges from main wholesale). LLM `update_task_status` routes through `toggleCaseTaskStatus` adapter on both refs, not through `updateTaskStatus`. Base TasksClient has zero references. WS5 Kanban drag is assignee-bucket-based (not caseId-based) per handoff §T8 correction — doesn't need `updateTaskStatus`. Nothing in WS2/WS3 assumes deletion. MAP-2 explicit-keep during W1 CP-3 prevented naive drop that would have broken build. Documented for reference.
- **N76 (P3, informational)** — WS5 planning notes locked. N63 (drag-drop time-wipe on month view) lives at CalendarClient handleDrop (hearing drag), immediately below the W1 conflict region, modified by neither side — stays W6b. `@dnd-kit` absent from deps (pruned @ `6a57fa4`); WS5 must `npm install` back. Zero package.json/lockfile drift in W1. WS5's assignee-drag on an independent task will hit `updateCaseTask` — now works via N70's OR-clause (or falls through to kept `updateTaskAssignee` per N71).
- **N77 (P3, informational)** — W1 rollback plan sound. Zero commits after `7c56610` on branch pre-execution; working tree clean; one stash exists but based on `3374d3d` (pre-dates everything, irrelevant). No remote-tracking ref for `feat/pr8-tasks-uplift-pillar-b` at time of Fable audit (`git ls-remote origin feat/pr8-tasks-uplift-pillar-b` empty 2026-07-11 09:47). Mid-resolution escape hatch: `git merge --abort`. Post-commit rollback: `git reset --hard 7c56610`. Post-merge to main: `git revert 0179f38` on hotfix branch. Documented for reference; not exercised — merge landed clean.

**W4 combined execution (2026-07-14)**
- **N78 (P1)** — createNote silent-failure at CaseDetailClient.tsx handleAddNote. Modal closed and input cleared regardless of Result envelope. Distinct defect axis from N66 on the same line. Resolution: W4 combined (PR #42, 5a57c2c) — .ok gate + noteError banner, modal stays open on failure.
- **N79 (P3)** — Trailing-period drift in settingsActions.changePassword: "Invalid input." (with period) diverged from the codebase's "Invalid input" convention (30 other sites). Symptom of no shared error-string constants. Resolution: W4 combined (PR #42, 5a57c2c) — corrected to "Invalid input" incidentally during taxonomy migration.
- **N80 (P2)** — Borderline conflation: 6 action-layer sites ("Case not found or unauthorized" ×2 in taskActions, "Task not found or not yours" ×4 in taskActions) + 1 duplicate dispatch-layer literal at dispatch.ts:290 = 7 total sites sharing one underlying constraint: single RLS-scoped Prisma findFirst query cannot distinguish "doesn't exist" from "exists but not yours." Resolution: closes by design in W4 combined (PR #42, 5a57c2c) — all 6 action-layer sites + the 3 calendarActions "Not authorized" sites classified as `not_found`. Distinguishing existence from ownership at the API boundary creates an existence oracle (security anti-pattern); RLS-scoped null return IS the security-correct collapse.
- **N81 (P3)** — LLM tool dispatch two-tier surface: 3 tool cases (update_task_status, update_task, delete_task) run raw RLS-scoped Prisma pre-flight reads with dispatch-local ad-hoc error strings, bypassing the Result<T> contract the other 15 tool cases rely on. Not a security issue (queries are RLS-scoped) — a contract-consistency gap. LLM-surface half resolved in W4 combined (PR #42, 5a57c2c) — pre-flight literals now typed against ErrorCode with `as ErrorCode` cast, `error_code: "not_found"` surfaced on tool responses. Structural half remains open — the 3 pre-flights still bypass the action layer; wrapping them in new action-layer helpers was rejected during W4 combined design review (Opus 4.7 stress-test, not Fable) — adds RLS-adjacent scope for zero visible benefit.

**W8 RLS runtime hardening batch (2026-07-16)**
- **N82 (P2)** — ✅ closed at W8. `deleteNote` cross-tenant DELETE fail-closed was uncovered — `verify-pillar-b-rls.ts` exercised the note↔event cascade delete only under userA's own scope, never a cross-tenant DELETE attack on a Note. Surfaced W8-recon CP-2 (uncatalogued census gap). Closed W8 via `verify-phase4-c1-update-rls.ts` assertion 4 (scoped-B `deleteMany` on A's note → count=0, note persists under A's re-read).
- **N83 (P2)** — ✅ closed at W8. `updateCaseAgreedFee` RLS-coverage gap — its distinct `updateMany` fail-closed shape (no owner-chain precheck; the `updateMany` count itself is the guard, see §10 Larger-debt `updateCaseAgreedFee` shape entry) was never exercised by any verify script. Surfaced W8-recon CP-2. Closed W8 via `verify-phase32-rls.ts` extension (+2: scoped-B `updateMany` on A's case → count=0; A re-read confirms `agreedFee` unchanged from seed value).
- **N84 (P3, DEFERRED)** — `verify-user-rls.ts` exit-code convention drift: throw-based precondition failure instead of the established `return 2` / 0/1/2 + cleanup-in-`.then` convention the newer runtime verify scripts follow. Surfaced W8-recon CP-4. Observed at W8 CP-4 execution that `verify-phase32-rls.ts` shares the same older throw-based pattern — the drift spans both scripts. Cosmetic/consistency only, no correctness impact. Deferred to a future micro-PR, NOT W8 scope.

**W9 PR1 — Schema-safe combo (2026-07-17)**
- **N85 (P3)** — ✅ closed at W9 PR1 via process fix. SOT §2 metadata-pointer silent drift: flip #9 (`6a18d0a`, #42 W4) shipped with §2 still reading `09113dc`/#40 (W3), one full merge cycle stale relative to its own stated merge (`5a57c2c`/#42 W4). Flip #10 (`7dd6268`, #43 W8) then jumped straight to `96067a5`/#43 — W4's merge was never recorded as `Current main sha` anywhere in SOT history. Evidence: `git show 6a18d0a:SOURCE_OF_TRUTH.md` §2. Root cause: no verbatim check between flip's own §2 body and the prior feature-merge sha. Closed W9 PR1 flip via new standing rule mandating plan-author diff §2 pointer against `git show <candidate-sha>:SOURCE_OF_TRUTH.md` before commit. See §2 pointer-discipline note. First exercise of the rule = this flip itself.
- **N86 (P3)** — ✅ closed at W9 PR1 (#44, `eaa71d1`). `Task_caseId_fkey` FK drift: migration `20260708131251_task_caseid_nullable` only ran `ALTER TABLE "Task" ALTER COLUMN "caseId" DROP NOT NULL`, never touched the FK constraint — `Task_caseId_fkey` remained `ON DELETE RESTRICT` despite `schema.prisma`'s implicit-SetNull intent for the optional relation. Masked because `deleteCase`'s app-layer cascade always deletes Task rows before Case, so the FK never fires. **Framing lock:** N86 is the SOLE genuine FK drift in the Case-children set. Note/CalendarEvent/Payment all correctly matched Prisma's implicit-Restrict default for required relations pre-PR1. W9 PR1's Cascade uplift on Note/CalendarEvent is deliberate behavior change (operational cleanup, DB-layer safety net beyond the app-layer `deleteMany` cascade), NOT drift repair. Payment→Case retained at Restrict by design — financial audit boundary; `deleteCase`'s app-side `payment.deleteMany` remains load-bearing, not belt-and-suspenders. Closed W9 PR1 via `ALTER TABLE "Task" DROP CONSTRAINT / ADD CONSTRAINT ... ON DELETE SET NULL` + `schema.prisma` `onDelete: SetNull`.

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
| PR1 | ✅ Done | **PR #26 (main @ `12bbc3a`).** Deleted `src/proxy.ts` (phantom middleware, misnamed). Stripped `authorized()` callback + matcher comment from `auth.config.ts`. Deleted `/sandbox` route entirely (static demo, zero nav refs). `/api/voice/transcribe` now returns 401 JSON on unauth (mirrors `/api/chat`). Layout-guard at `(lawdger)/layout.tsx` remains sole page-route auth boundary. N19/N20/N21 closed. |
| PR2 | ✅ Done @ 8edef7e — VoiceFAB stub stripped, rewire deferred to voice-polish phase | VoiceFAB strip (N23) — remove decorative FAB; voice lives on `/chat` only until rewire |
| PR3 | ✅ Done @ db48bb9 | LLM tool migration + per-tool Zod (N4/N10/N24a/N25/N26/N28 closed). `src/lib/llm/tools/` — definitions, dispatch (per-tool safeParse), schemas, index. N24b + N38 → PR8. |
| PR4 | ✅ Done @ `795e898` | `revalidatePath` cross-table gap closure (N3 closed). 29 additions across 4 action files. N39 surfaced during recon → PR8. |
| PR5 | ✅ Done @ `e387450` | User RLS verify script (N6 closed). `verify-user-rls.ts` (+4 assertions) modeled on `verify-isolation.ts`, wired into `smoke:rls-runtime`. Runtime count 32/6 → 36/7 (prior "28/6" figure was drift, corrected retroactively). |
| PR6a | ✅ Done @ `6a57fa4` | Dep + audit hygiene (L6/S2/N33/N34) — strip `next-pwa` + `@dnd-kit/{core,sortable,utilities}`, move `@types/bcryptjs` to `devDependencies`, bump `next` 16.2.4 → 16.2.10, delete orphan `public/manifest.json` + dangling `<link rel="manifest">` in `layout.tsx`. N41 opened (postcss transitive, awaits upstream). |
| PR7 | ✅ Done @ `5974272` (#34) | 3.2.6 Pillar A — `financeActions` Zod + `Result<T>` + `revalidatePath` normalization; `Case.nextHearingDate` becomes synced cache column (`src/lib/calendar-sync.ts`, wired into all `CalendarEvent` mutations); Day/Week all-day row. `@/lib/result` extraction (L4/L9/S13/N1/N2/N5/N11/N12) not done — remains tracked in §10. Cleanup pass: N42 (idSchema `min(1)`→`.uuid()` alignment, 11 fields across `caseActions`/`noteActions`/`taskActions`) closed @ `37292f7` (#35); N43 (`dashboardActions.ts` `nextHearingDate` `groupBy` redundancy → direct cache-column read) closed @ `4e009c2` (#36). |
| PR9 (landed ahead of PR8) | ✅ Done @ `3bc3742` (#37) | Independent Tasks — Task.caseId nullable migration (first constraint-changing migration in repo history, via Supabase MCP execute_sql workaround); RLS-safe uplift of createTask/updateTask/deleteTask/updateTaskStatus/getTasksWithDueDate (N38-class fix on legacy taskActions, separate from PR8's WS1 which covers different functions); P0 fix for getTasksWithDueDate (Calendar task list was silently empty ~4 weeks). Closes N44/N45/N46. Opens N47 (seed script bare-Prisma bug, not fixed). |
| Phase 6 — Legal Brain RAG | 🤝 External | N17/N27/N30/N31 + RAG architecture — Deferred to external dev. Baseline shipped via Phases 1–5.2b + internal queue PR1–PR8 + voice-polish + schema-cleanup + RLS hardening. Not in internal build queue. |

### Active queue (post-Fable 5)

| ID | Workstream | Scope | Sequencing |
|----|-----------|-------|------------|
| W1 | ✅ Done @ `0179f38` (#39) | PR8 pillar-b reconciliation. Merged main→feat/pr8, whole-function granularity on taskActions.ts, MAP-1 (CalendarClient → main) + MAP-2 (taskActions mixed provenance per function) + MAP-3 (dispatch → PR8 hybrid + 2 comment rewrites) + FIX-1 (updateCaseTask OR-clause + null-guarded revalidate) + AMEND-1 (module header). Closes N48/N53/N69/N70/N71/N72/N73. Folds N74/N75/N76/N77. WS5 (Kanban drag-drop + @dnd-kit) NOT included — split to separate future workstream. | — |
| W6 | ✅ Done @ `1c49346` (#38) | IST date-semantics + N67 cache-render guard. Closes N49, N67, N68. N63 (drag-drop time wipe) split out — see W6b. | — |
| W6b | N63 (drag-drop month-view time wipe) | Preserve source event time-of-day on date-only drops. `CalendarClient.tsx:284–290`. | Parallel filler |
| W2 | Seed-script RLS fix (N47) | auth_create_user RPC or DIRECT_URL | Parallel |
| W3 | ✅ Done @ `09113dc` (#40) | LLM tools + /tasks modal independent-task parity. `create_task`/`update_task_status`/`delete_task` extended to hybrid-dispatch (null `caseId` → independent-task actions, UUID `caseId` → case-linked adapters, mirrors pre-existing `update_task` pattern). /tasks modal gains "— No Case (Independent Task)" option, `canSubmit` gate dropped, `isUrgent` checkbox conditionally rendered only when a case is selected. Closes N54/N55. Verified end-to-end via Chrome MCP matrix (7/7 checks PASS). No RLS surface touched — 38/7 assertion baseline unchanged. | — |
| W4 | ✅ Done @ `5a57c2c` (#42) | Silent-failure UI sweep + error taxonomy (W5.1 folded): 65 action-layer sites migrated to `fail(code, message)` with a 4-code discriminated union (validation/not_found/credential/system); 21 LLM dispatch passthroughs + 3 pre-flight literals typed against `ErrorCode`; 10 client silent-failure sites wired (`.ok` gates + snapshot/rollback on drag-drop). Closes N50, N51 (client half), N78, N79, N80 (by design), N81 (LLM-surface half). | — |
| W5 | ✅ Done @ `4f7a8c3` (#41) | Contract-3.2.6 uplift completion: `src/lib/result.ts` extracted (5 duplicates consolidated); `financeActions::getFinancesData` + full `calendarActions.ts` + full `dashboardActions.ts` Zod+Result uplift; `requireUserId.ts` retired (10 call sites → `getServerUser`); `signup/actions.ts` Zod hardening (min-8 password, email format); `createPayment` status z.enum; N60 truthiness + client `\|\| undefined` removal (both halves); `getTasksWithDueDate` return-type narrowing; sequential-awaits at `calendar/page.tsx` + `cases/page.tsx`; stale FORCE-RLS comment sweep. Closes N51 (server), N52, N57, N58, N60, N62, N64. Consumer coupling handled inline for finances/calendar/dashboard/tasks pages + LLM dispatch (4 tool cases). 38/7 RLS baseline unchanged. Chrome MCP matrix PASS on 8/9 tests (N/A on drag-drop synth + N58 UI). | — |
| W5.1 | ✅ Done (folded into W4, #42) | SUPERSEDED — folded into W4 combined. Original scope: Discriminated Result variant OR error code enum for ~35 return sites; picks alignment with dispatch.ts LLM-facing surface (currently forwards `result.error` verbatim). Recon (W5 CP-3) surfaced 3 options; execution deferred until W4 client sweep or W12 notifications creates a real consumer. Locked design executed in W4: 4-code discriminated union via const-asserted array + `(typeof X)[number]` union (matches `CASE_TYPES` idiom, `src/lib/case-constants.ts`). See W4 row. | — |
| W7 | PR6b hex-token sweep (N35/N36) | Replace 16 raw hex with @theme tokens | Parallel filler |
| W8 | ✅ Done @ `96067a5` (#43) | RLS hardening batch — `verify-phase4-c1-update-rls.ts` (+4: updateNote ×3 + deleteNote ×1, closes N82); `verify-phase4-a7-update-task-rls.ts` (+3: updateCaseTask both OR-branches + positive-control survival); `verify-pillar-b-rls.ts` extension (+3: updateCalendarEvent fail-closed); `verify-phase32-rls.ts` extension (+2: updateCaseAgreedFee fail-closed, closes N83). Harness self-counting fix (N65) — stdio pivot to `["inherit","pipe","inherit"]` + regex `TOTAL` aggregation, eliminating hand-count drift. Baseline 38/7 → 50/9. Closes N9, N65, N74, N82, N83. N84 (verify-script exit-code convention drift) deferred, non-blocking. | — |
| W9 | Schema-cleanup pass (4 sub-PRs: PR1 ✅ / PR2 / PR3 / PR4 pending) | **PR1 ✅ @ `eaa71d1` (#44)** — Payment.status → Postgres enum PaymentStatus; FK-norm on Case children: Note→Cascade + CalendarEvent→Cascade (operational cleanup, deliberate uplift), Task→SetNull (N86 fix, sole genuine drift), Payment→Restrict retained (financial audit boundary); 7 opportunistic N61 indexes (Note ×2, Task ×2, Payment ×2, CalendarEvent ×1); TS narrowing on `financeActions.ts` to `z.nativeEnum(PaymentStatus)`. Closes N85 (via process fix), N86. Zero verify delta. **PR2 pending** — `Case.nextHearingDate` column drop, live groupBy migration, `calendar-sync.ts` deletion. **PR3 pending** — `deleteCase` `$transaction` wrap + `document.deleteMany` + 1 RLS assertion (N59). **PR4 pending** — Payment.amount + Case.agreedFee Float→Int paise atomic migration. | After W5+W8 |
| W10 | Trust-claims reconciliation (N56) | Remove E2E badge; Gemini retention verify | Parallel |
| W11 | Phase 9 — production cutover | Vercel + lawdger_app + DIRECT_URL IPv4 + env validator + rate-limit + next-auth stable | After W9 |
| W12 | Phase 7 — Notifications | Daily brief, task/payment reminders, overlap alerts | After W11 |
| W13 | Chatbot widget uplift | Parked until W3 stabilizes tool surface | After W3 |

**Critical path:** ~~W1~~ → ~~W3~~ → ~~W5~~ → ~~W4~~ → ~~W8~~ → **W9** (PR1 ✅ / PR2 / PR3 / PR4) → W11.
**Parallel fillers still available:** W2 (N47 seed script bare-Prisma), W6b (N63 month-view drag-drop time wipe).
**Out of scope:** Phase 6 Legal Brain RAG + voice-infra polish (Chirag).

### Fable ledger

- 1 used (W1 stress-test, T1–T10 → CONDITIONAL GO / findings N69–N77)
- W5 shipped without Fable (established patterns from W1 dispatcher + PR7 financeActions mutators + W3 hybrid; no new architecture)
- Fable ledger: 1 remaining (unchanged). Prior handoff projected W5.1 taxonomy design as consuming the last credit; actual execution used Opus 4.7 architectural stress-test across recon CP-6 → locked design, no Fable model invoked. Standing rule preserved: reserve for WS5 drag-drop design review; do NOT burn on parallel fillers.

---

## 14. Rollback

### W1 — PR8 pillar-b reconciliation (PR #39)

**Failure mode A — regression in independent-task edit path (N48/N70 fix broken):**
1. `git revert 0179f38` on a hotfix branch.
2. `npm run smoke` + Chrome MCP manual matrix cells [3] and [13] re-run.
3. PR to main, fast-track merge.
4. No schema changes — DB rollback not required.
5. Behavior regression tolerated: /tasks board independent-task edit reverts to error banner; LLM unlink path reverts to no-op.

**Failure mode B — LLM tool dispatch broken (update_task routing regression):**
1. Same revert path as Failure mode A.
2. Investigate dispatch.ts hybrid branching (COMMENT-1/COMMENT-2 lines) before re-merging.

### W5 — Contract-3.2.6 uplift (PR #41)

- **Squash commit:** `4f7a8c3 W5: contract-3.2.6 uplift completion (#41)`
- **Parent:** `2941321` (SOT flip #7)
- **Rollback:** `git revert 4f7a8c3` (single squash commit; internal W5.1–W5.8 + W5.2b history not preserved in main).
- **Affected surfaces:** `src/lib/result.ts` (new), `src/actions/requireUserId.ts` (deleted), 8 action/page/dispatch files rewired. RLS assertion baseline unchanged (38/7).
- **Reverting caveat:** Downstream W4 (client `.ok` wiring), W5.1 (error taxonomy), and any future action following the `getServerUser` + `Result<T>` pattern will need the same infrastructure reintroduced. Prefer forward-fix over revert unless a hard regression surfaces.

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