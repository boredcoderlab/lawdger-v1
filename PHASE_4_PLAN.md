# Phase 4 — Notes / Tasks / Calendar: Three-Pillar Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan pillar-by-pillar. Each pillar ships as an independent PR. CC prompt outlines are in §6–8; full execution prompts are authored in each pillar's dedicated session.

**Goal:** Close the three structural P4 gaps: (C) chat-route 500 blocking the AI assistant, (A) `/tasks` global page running 100% on mock data, (B) the auto-event pipeline from "Next Date" notes to CalendarEvents being entirely absent.

**Architecture:** Three independent pillars executed in sequence C → A → B. Each pillar ships its own branch and PR before the next begins. No pillar depends on another's code changes at the schema or action layer — sequencing is driven by smoke-testing and blast-radius safety (Pillar C unblocks the chat route before A and B are manually verified against it).

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4, Prisma `@prisma/client`, Zod, NextAuth v5. Supabase Postgres — RLS enforced locally via `lawdger_app`.

---

## 1. Goal + Non-Goals

### In scope (P4)

- Fix `chat/route.ts` module-load 500 (NoteCategory type extraction)
- Replace `SEED` constant in `TasksClient.tsx` with real DB data
- Wire Kanban status-toggle and delete to 3.2-compliant actions
- Expose category picker in note composer sidebar (required for "Next Date" to be reachable without voice)
- `createNote(category: "Next Date", hearingDate: ...)` auto-creates a `CalendarEvent` in the same transaction
- Extend verify-script coverage to Note, Task, CalendarEvent tables (closes audit gap §6a)

### Out of scope (deferred)

| Item | Phase |
|------|-------|
| Voice capture, Gemini classification, audio pipeline | P5 |
| Legal Brain RAG / document embeddings | P6 |
| Financial analytics, payment automation | P7 |
| Full-text search | P7 |
| Note edit (`updateNote`) | P4+ — not in P4 scope |
| Standalone `/notes` page | P4+ — not in P4 scope |
| Postgres `NoteCategory` enum (currently TS const + String column) | Acceptable as-is through P5; revisit at P6 |
| `eventType` enum on `CalendarEvent` | Acceptable as-is through P5 |
| 3.2.6 full contract uplift for `calendarActions`, `dashboardActions`, `financeActions`, `taskActions` legacy half | P3.2.6 (sequenced post-3.0.1, independent sprint) |
| Server-side missed-date alerts / push notifications | P5+ |
| `/tasks` task creation without a linked case | Schema decision — deferred (see §7 Fork A4) |

---

## 2. Pre-conditions

- `phase-3-5-cases-ui-hygiene` merged to `main` (P3.5 gate PASS)
- `npm run smoke` green on `main` post-merge
- Chat route may still be 500 at P4 start — **Pillar C lifts it**
- No uncommitted action or schema changes in working tree at start of each pillar

---

## 3. Recommended Sequencing: C → A → B

| Order | Pillar | Reason |
|-------|--------|--------|
| 1st | **C — Chat-500 fix** | Smallest blast radius; unblocks `/api/chat` for manual smoke of A and B; single-file refactor |
| 2nd | **A — Kill /tasks mock** | Biggest visible lie in the codebase; independent of Note/Calendar; unblocks honest smoke reporting |
| 3rd | **B — Auto-event pipeline** | Most architecturally complex; requires Pillar C's clean type module (`noteActions.types.ts`) to already exist; extends `createNote` which must be stable |

Each pillar is its own branch (`phase-4c-chat-fix`, `phase-4a-tasks-db`, `phase-4b-auto-event`) and its own PR. Merge each before starting the next.

---

## 4. Schema Migration Assessment

| Pillar | Migration needed? | Reason |
|--------|-------------------|--------|
| C | ❌ No | Pure TypeScript refactor — no schema touch |
| A | ❌ No (if Fork A2 = drop priority) | `priority` field was never in schema. `listAllTasks` is a new action, not a schema change. If Fork A2 = add schema field, a migration is required — see §7. |
| B | ❌ No | `CalendarEvent` already has `caseId`, `userId`, `hearingDate DateTime`, `title`, `description?`. Auto-creation uses existing fields. `createNote` Zod schema extends with optional `hearingDate` — action-layer only. |

**If any migration is needed** (only possible in Pillar A Fork A2): use `npm run prisma migrate diff` + `npm run prisma migrate deploy` workaround. `prisma migrate dev` is broken on this repo. `npm run prisma <subcmd>` mandatory for dotenv-cli.

---

## 5. Verify-Script Coverage Plan (Closes Audit Gap §6a)

Current gap: Note, Task, CalendarEvent, Payment, Document have no runtime cross-user isolation test. Only Case is covered.

**Plan:** Add `scripts/verify-phase4-rls.ts`. This script runs cross-user read/write isolation tests for:

| Table | Added by | Test pattern |
|-------|----------|-------------|
| `Note` | Pillar C session | User A creates note → User B cannot read it via scoped Prisma |
| `Task` | Pillar A session | User A creates task → User B cannot read it via scoped Prisma |
| `CalendarEvent` | Pillar B session | User A creates event → User B cannot read it via scoped Prisma |

The script follows the same pattern as `verify-isolation.ts` (sets `app.current_user_id` GUC via `$queryRaw`, then attempts cross-user read via scoped Prisma, expects empty result).

Wire into `npm run smoke` alongside existing verify scripts by adding to the `smoke:rls-runtime` entry in `package.json`. Gate: must be included and passing before each pillar's PR is opened.

CC prompt for each pillar must include: "add cross-user isolation test for [table] to `scripts/verify-phase4-rls.ts`" as the final step before the gate commit.

---

## 6. Pillar C — Chat-500 Fix + NoteCategory Type Extraction

### Scope

Fix the `"use server" file can only export async functions, found object` 500 on `src/app/api/chat/route.ts` import. Root cause: `noteActions.ts:14` exports `NOTE_CATEGORIES` (a const object) from a `"use server"` file; `chat/route.ts:14` imports `type NoteCategory` from that file, which triggers the loader under Next.js 16 + Turbopack.

Fix: extract `NOTE_CATEGORIES` const + `NoteCategory` type to a side-car file with no `"use server"` directive.

### Decision Forks

None — this is a mechanical refactor with one correct solution. No locked decisions require Sahil sign-off before execution.

### Touch List

| File | Action | Notes |
|------|--------|-------|
| `src/actions/noteActions.types.ts` | **CREATE** | New file. No `"use server"`. Exports `NOTE_CATEGORIES as const` + `NoteCategory` type. |
| `src/actions/noteActions.ts` | **MODIFY** | Remove `NOTE_CATEGORIES` + `NoteCategory` definitions. Re-export `NOTE_CATEGORIES` const (not the type) from `./noteActions.types` for backward compat with any importer that does `import { NOTE_CATEGORIES } from "@/actions/noteActions"`. |
| `src/app/api/chat/route.ts:14` | **MODIFY** | Change import: `import { type NoteCategory } from "@/actions/noteActions"` → `import { type NoteCategory } from "@/actions/noteActions.types"` |
| `src/components/CaseDetailClient.tsx` | **VERIFY + maybe modify** | Grep: does it `import { NoteCategory }` or `import { NOTE_CATEGORIES }` from noteActions? If type import: switch to `noteActions.types`. If const import: backward-compat re-export covers it. |
| `src/app/(lawdger)/cases/[id]/page.tsx` | **VERIFY + maybe modify** | Same grep as above — `CATEGORY_COLOR` map likely imports `NoteCategory`. |

### Gate

- [ ] `npm run smoke` exits 0
- [ ] `npm run dev` + navigate to chat page (or `curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/chat`) — no 500 on module load
- [ ] `NOTE_CATEGORIES` still accessible from both `noteActions.ts` and `noteActions.types.ts` (backward compat)
- [ ] `scripts/verify-phase4-rls.ts` created with Note table cross-user isolation test, exits 0

### CC Prompt Outline

**Session opens with:** Read `noteActions.ts:1-35` + `chat/route.ts:1-30` + grep `NoteCategory` across `src/`. Report: all import sites + whether backward-compat re-export is needed.

```
Model: claude-sonnet-4-6
Reason: Mechanical refactor — type plumbing, single-file create, 2-3 import site updates. No architectural judgment needed.
Branch: phase-4c-chat-fix (from main post-P3.5 merge)

Pre-flight reads:
  - src/actions/noteActions.ts (full, ~105 lines)
  - src/app/api/chat/route.ts:1-30
  - grep -r "NoteCategory\|NOTE_CATEGORIES" src/ --include="*.ts" --include="*.tsx"

Locked decisions: [none — pure refactor]

Hard constraints:
  - noteActions.types.ts must NOT have "use server" directive
  - noteActions.ts MUST retain "use server" directive — only the type/const move
  - Re-export NOTE_CATEGORIES const from noteActions.ts (backward compat); do NOT re-export the type
  - Zero schema migrations, zero action contract changes
  - npm run smoke green before commit

Action outline:
  1. Create src/actions/noteActions.types.ts
  2. Move NOTE_CATEGORIES + NoteCategory to types file
  3. Add re-export of NOTE_CATEGORIES const in noteActions.ts
  4. Update chat/route.ts:14 import
  5. Update any other NoteCategory type importers found in grep
  6. npm run smoke:tsc — clean
  7. Add Note cross-user isolation test to scripts/verify-phase4-rls.ts
  8. Single commit: refactor(chat): extract NoteCategory type — fix chat-route 500

DO NOT:
  - Add "use server" to noteActions.types.ts
  - Re-export NoteCategory type from noteActions.ts (that re-introduces the bug)
  - Touch noteActions.ts action functions
  - Touch schema or migrations
  - Open PR — Sahil opens manually

STOP and report:
  - Commit sha
  - List of all import sites updated
  - Manual smoke result: chat route status (200 vs 500)
  - verify-phase4-rls.ts Note test result
```

---

## 7. Pillar A — Kill /tasks Mock + DB Wiring

### Scope

Replace the `SEED` constant in `TasksClient.tsx` (lines 102–221, 8 fake tasks) with real DB data. Wire Kanban status-toggle and delete to 3.2-compliant actions. Add a new 3.2-compliant `listAllTasks` action for the global read. Drop the `priority` UI field (no DB backing). Handle Kanban column grouping by `assignee` field.

### Decision Forks

#### Fork A1 — Legacy action uplift vs. new `listAllTasks` action

| Option | Approach | Trade-off |
|--------|----------|-----------|
| **A1 (recommended)** | Add `listAllTasks` (new 3.2-compliant action) alongside legacy half. Wire reads to it. Wire mutations to the existing compliant trio (`createCaseTask`, `toggleCaseTaskStatus`, `deleteCaseTask`). | No 3.2.6 dependency. Legacy half untouched — cannot regress. Compliant trio is already audited and working. |
| A1-alt | Pull 3.2.6 uplift forward: fully upclift `getTasks`, `createTask`, `updateTask`, `deleteTask` to 3.2 contract now. | More work (~7 functions). Blocks P4A on a larger scope. Risk of introducing bugs in currently-working case-scoped flows. |

**Locked recommendation: A1.** `listAllTasks` is a new function that reads all tasks for the current user via `withServerUserContext`. The legacy half is left as-is, still sequenced to 3.2.6. This means the only legacy function called from the global page is eliminated (the `getTasks` call that doesn't exist yet — it was never wired, so there's nothing to replace). We add `listAllTasks` cleanly alongside the existing file.

#### Fork A2 — `priority` field: drop vs. schema migration

| Option | Approach | Trade-off |
|--------|----------|-----------|
| **A2 (recommended)** | Drop `priority` from `TasksClient.tsx`. Remove `TaskPriority` type and all priority display/badges. | No migration. Zero DB impact. Clean. P5 voice classification, if it categorizes urgency, can re-add with a proper migration at that point. |
| A2-alt | Add `priority String?` to Task schema. Migrate. Wire UI. | Requires migration. Premature — no AI classification yet to populate it. Adds schema surface with no reads in P5. |

**Locked recommendation: A2 (drop).** `TaskPriority` type and all priority badge UI are removed. No migration.

#### Fork A3 — Kanban column grouping by `assignee`

~~4 columns~~ **Locked override: 3 columns.** The `clerks` column is dropped. No `role` field exists on Task — a permanently empty column is a different lie from SEED, not a fix. Revisit when Task gains a role/category field (P5+).

| Column key | Assignee string | Rule |
|------------|----------------|------|
| `unassigned` | `"Unassigned"` (schema default) | Exact string match |
| `my-plate` | Current user's session name | `assignee === session.user.name` |
| `associates` | Any non-"Unassigned" value that isn't the session user | Fallback bucket |

**Locked: implement grouping in `tasks/page.tsx` (server component)** using session from `auth()` to determine `my-plate` bucket. CC confirms the `session.user.name` field path during pre-flight. `TasksClient` receives a 3-column `ItemsState` shape.

#### Fork A4 — Task creation from global `/tasks` page

Task schema: `caseId String` (required FK → Case). The global `/tasks` Kanban currently creates tasks with fake `caseId` strings. With real DB, creating a task requires a real `caseId`.

| Option | Approach | Trade-off |
|--------|----------|-----------|
| **A4 (recommended)** | Require case selection in the global Kanban create dialog. Add a `<select>` populated from `getCasesForSelect()` (already exists in `calendarActions.ts`). Pass selected `caseId` to `createCaseTask`. | No migration. `caseId` stays required. User always knows which case the task belongs to. Matches Indian litigation practice (tasks are case-bound). |
| A4-alt | Make global page read-only (no task creation from `/tasks`); creation stays in CaseDetail sidebar docket. | Simpler for P4. Breaks existing UX expectation of the Kanban. |
| A4-alt2 | Make `caseId` optional in schema (migration). Allow tasks without a case. | Migration required. Product question — are there truly "general" tasks not tied to any case? Defer. |

**Locked recommendation: A4 (require case selection).** Case selector in create dialog uses `getCasesForSelect()` from `calendarActions.ts` (already implemented, returns `{ id, title, caseNumber }`). Note: `getCasesForSelect` has a string/enum drift bug (filters `status: "ACTIVE"` as string literal — works at runtime but not TS-strict). Fix this in the same commit: change to `CaseStatus.ACTIVE` import.

### Touch List

| File | Action |
|------|--------|
| `src/actions/taskActions.ts` | **MODIFY** — add `listAllTasks` (3.2-compliant: `withServerUserContext`, scoped Prisma, `Result<Task[]>`). Do NOT touch legacy half. |
| `src/actions/calendarActions.ts:95` | **MODIFY** — fix `getCasesForSelect` string/enum drift: `status: "ACTIVE"` → `status: CaseStatus.ACTIVE` (import `CaseStatus` from `@prisma/client`). |
| `src/app/(lawdger)/tasks/page.tsx` | **REWRITE** — convert to async server component. Call `listAllTasks()` + `auth()` for session. Group tasks by assignee into `ItemsState` shape. Pass `initialTasks` + `activeCases` (for create dialog) as props. |
| `src/components/TasksClient.tsx` | **MODIFY** — remove `SEED` constant (lines ~102–221); remove `TaskPriority` type + all priority display; accept `initialTasks: ItemsState` prop; update `handleSave` (create) to call `createCaseTask` with case selector; update `handleDelete` to call `deleteCaseTask`; update status-toggle to call `toggleCaseTaskStatus`; update create dialog to include case `<select>`. |
| `scripts/verify-phase4-rls.ts` | **MODIFY** — add Task cross-user isolation test (or create file if Pillar C hasn't run yet — C runs first, so file exists). |

**Files that must NOT be touched:**
- Legacy task action functions (`getTasks`, `createTask`, `updateTask`, `updateTaskStatus`, `updateTaskAssignee`, `getTasksWithDueDate`, `deleteTask`) — leave intact, 3.2.6 will handle them
- `prisma/schema.prisma` (if Fork A2 = drop priority — no migration)
- `src/actions/noteActions.ts`, `src/actions/caseActions.ts`
- `src/app/api/chat/route.ts`

### Gate

- [ ] `npm run smoke` exits 0
- [ ] `/tasks` page loads with real DB tasks (empty state if no tasks, not fake tasks)
- [ ] Kanban columns populated correctly by assignee
- [ ] Create task: case selector present; creating a task persists to DB; reloading `/tasks` shows it
- [ ] Status toggle: checking a task toggles its status in DB
- [ ] Delete: deleting a task removes it from DB
- [ ] No `SEED` constant anywhere in `TasksClient.tsx` (grep)
- [ ] No `TaskPriority` type anywhere in `TasksClient.tsx` (grep)
- [ ] Regression: CaseDetail docket task flows (createCaseTask, toggleCaseTaskStatus, deleteCaseTask) unaffected
- [ ] `scripts/verify-phase4-rls.ts` Task test exits 0

### CC Prompt Outline

**Session opens with:** Read `TasksClient.tsx` full (1305 lines), `tasks/page.tsx` (5 lines), `taskActions.ts` (255 lines) with focus on the compliant trio + file header. Report: exact line range of SEED, exact shape of ItemsState type, how `handleSave`/`handleDelete`/drag-drop mutate state today, whether `toggleCaseTaskStatus` takes `{ id, status }` or `{ id }` (toggle only).

```
Model: claude-opus-4-7
Reason: 1305-line component rewrite with Kanban grouping logic, case selector
integration, and coordinated 3-file change. Architectural judgment on prop shape.
Branch: phase-4a-tasks-db (from main post-P4C merge)

Pre-flight reads:
  - src/components/TasksClient.tsx (full — 1305 lines)
  - src/app/(lawdger)/tasks/page.tsx (5 lines)
  - src/actions/taskActions.ts (full — 255 lines)
  - src/actions/calendarActions.ts:85-99 (getCasesForSelect)
  - src/lib/session.ts (getServerUser / auth() call pattern)

Locked decisions:
  - A1: new listAllTasks action — do NOT touch legacy half
  - A2: drop TaskPriority + priority badges — no migration
  - A3: THREE columns only — unassigned / my-plate / associates (clerks column dropped — no role field)
    Grouping logic in tasks/page.tsx server component using session.user.name for my-plate
  - A4: require case selection in global create dialog — use getCasesForSelect()
  - Fix getCasesForSelect string/enum drift in same commit as calendarActions touch

Hard constraints:
  - Legacy taskActions functions (getTasks, createTask, etc.) must remain untouched
  - Zero schema migrations
  - Zero "any" types
  - withServerUserContext sequential awaits — no Promise.all over scoped ops
  - npm run smoke:tsc clean before every commit
  - git diff before every commit (no auth bypass)

Action outline:
  1. Add listAllTasks to taskActions.ts (3.2 contract)
  2. Fix getCasesForSelect CaseStatus.ACTIVE
  3. Rewrite tasks/page.tsx as server component
  4. Remove SEED from TasksClient.tsx; accept initialTasks prop
  5. Remove TaskPriority type + priority display from TasksClient.tsx
  6. Wire handleSave → createCaseTask (with case selector)
  7. Wire handleDelete → deleteCaseTask
  8. Wire status toggle → toggleCaseTaskStatus
  9. npm run smoke:tsc clean
  10. Add Task cross-user isolation test to scripts/verify-phase4-rls.ts
  11. Two commits:
      - "feat(tasks): add listAllTasks; wire tasks/page.tsx to real DB; drop SEED + priority"
      - "test(rls): add Task cross-user isolation to verify-phase4-rls.ts"

DO NOT:
  - Touch legacy half of taskActions.ts
  - Run prisma migrate in any form
  - Import SEED or any hardcoded task data
  - Add Promise.all over scoped Prisma ops
  - Touch noteActions.ts, caseActions.ts, chat/route.ts
  - Open PR — Sahil opens manually

STOP and report:
  - Both commit shas
  - grep output confirming SEED and TaskPriority are gone from TasksClient.tsx
  - Manual smoke: /tasks page load screenshot (or describe content)
  - Manual smoke: create task → DB confirm → reload verify
  - verify-phase4-rls.ts Task test result
```

---

## 8. Pillar B — Auto-Event-from-Date Pipeline

### Scope

Wire the missing cascade: when `createNote` is called with `category: "Next Date"` AND a `hearingDate` is supplied, automatically create a `CalendarEvent` inside the same `withServerUserContext` transaction. Update the note composer sidebar in `CaseDetailClient.tsx` to show a category picker and a date field when "Next Date" is selected. Update the `create_note` AI tool definition in `chat/route.ts` to supply `hearingDate` when the AI classifies a note as "Next Date".

### Decision Forks

#### Fork B1 — Date extraction: client-supplied vs. server-side parse

| Option | Approach | Trade-off |
|--------|----------|-----------|
| **B1 (locked — recommended in session brief)** | Client (UI or AI tool) supplies `hearingDate: string` (ISO datetime) alongside `cleanContent`. Server validates and creates event. | Deterministic server action. No regex fragility. AI classification at P5 can supply structured dates from Gemini. |
| B1-alt | Server parses `cleanContent` to extract a date using regex or `date-fns/parse`. | Fragile — format varies. Fails silently on ambiguous dates. Wrong architectural layer for fuzzy parsing. |

**Locked: B1.** `createNote` Zod schema gains optional `hearingDate: z.string().datetime().optional()`. The pipeline fires only when BOTH `category === "Next Date"` AND `hearingDate` is present. If either is absent, note is created without an event (no error).

#### Fork B2 — Category picker in note composer sidebar

Currently `CaseDetailClient.tsx` hardcodes `category: "General Note"` in the sidebar note composer. For users to reach "Next Date" without the AI assistant (which is still broken until Pillar C), the sidebar must expose the category picker.

| Option | Approach | Trade-off |
|--------|----------|-----------|
| **B2 (recommended)** | Add `<select>` for `NOTE_CATEGORIES` in sidebar note composer. Date field (`<input type="date">`) renders **only** when `category === "Next Date"` — it is conditionally rendered, not always visible. | Completes the P4 surface for non-voice users. Conditional date prevents confusing date input on General Note / Client Update. Required for manual smoke of the pipeline. |
| B2-alt | Leave sidebar hardcoded to "General Note". Pipeline only reachable via AI chat. | Can't manually smoke the pipeline. AI chat may still be broken at P4B start (depends on Pillar C). |

**Locked recommendation: B2 (add category picker + conditional date field).** Pillar C runs before B, so the AI chat route should be live by the time P4B executes — but the UI path is essential for manual smoke regardless.

### Touch List

| File | Action |
|------|--------|
| `src/actions/noteActions.ts` | **MODIFY** — extend `createNoteSchema` Zod: add `hearingDate: z.string().datetime().optional()`. Inside `createNote`, after note insert, if `category === "Next Date" && hearingDate`: insert `CalendarEvent` in same `withServerUserContext` tx. Update return type to `Result<{ noteId: string; eventId?: string }>`. |
| `src/components/CaseDetailClient.tsx` | **MODIFY** — sidebar note composer: replace hardcoded `category: "General Note"` with controlled `<select>` over `NOTE_CATEGORIES`. Add conditional `<input type="date">` when `category === "Next Date"`. Pass `category` + optional `hearingDate` to `createNote` call. Import `NOTE_CATEGORIES` from `"@/actions/noteActions.types"` (the new file from Pillar C). |
| `src/app/api/chat/route.ts` | **MODIFY** — `create_note` tool definition: add `hearingDate` as an optional parameter (`string`, ISO format). In `executeTool` `case "create_note"`: pass `hearingDate` from `args` to `createNote`. |
| `scripts/verify-phase4-rls.ts` | **MODIFY** — add: (1) CalendarEvent cross-user isolation test; (2) Note pipeline integration test: create Note with `category: "Next Date"` + `hearingDate` → confirm CalendarEvent exists with same `caseId` + `userId`; (3) atomicity test: simulate CalendarEvent insert failure (e.g. force a NOT NULL violation on a required field) inside the transaction → assert both Note and CalendarEvent are absent post-failure (full rollback). |

**Files that must NOT be touched:**
- `prisma/schema.prisma` (no new fields needed)
- `src/actions/calendarActions.ts` (pipeline does NOT call `createCalendarEvent` from the action; it inserts `CalendarEvent` directly inside the `createNote` `withServerUserContext` tx using the scoped Prisma client)
- `src/actions/caseActions.ts`, `src/actions/taskActions.ts`
- `TasksClient.tsx`, `CalendarClient.tsx`

**Key implementation constraint:** The `CalendarEvent` insert happens inside `createNote`'s own `withServerUserContext` transaction — not via a separate `createCalendarEvent` action call. Calling one server action from another is not safe under `"use server"` semantics. The Prisma insert is direct.

**CalendarEvent field derivation inside `createNote`:**

```ts
// When category === "Next Date" && hearingDate is provided:
const eventTitle = `Hearing — ${caseTitle}`; // caseTitle fetched from parent Case in same tx
await tx.calendarEvent.create({
  data: {
    caseId,
    userId,
    hearingDate: new Date(hearingDate),
    title: eventTitle,
    description: cleanContent, // note content becomes event description
  },
});
```

CC must fetch the parent Case title inside the `withServerUserContext` tx to populate `eventTitle`. The case ownership check (already present in `createNote`) already fetches the case — CC should use that fetched case object rather than making a second query.

### Gate

- [ ] `npm run smoke` exits 0
- [ ] Sidebar note composer: category selector visible; "Next Date" selected → date field appears
- [ ] Create note with "Next Date" + date → note created + CalendarEvent auto-created in DB (verify in Supabase dashboard or calendar page)
- [ ] Create note with "General Note" → only note created, no CalendarEvent
- [ ] Create note with "Next Date" but no date → only note created, no error
- [ ] Calendar page: auto-created event appears on correct date under the correct case
- [ ] AI chat (`chat/route.ts`): `create_note` tool with `category: "Next Date"` + `hearingDate` → pipeline fires (test via manual chat interaction or direct tool call)
- [ ] Regression: existing note create flows (General Note from sidebar) unaffected
- [ ] Regression: existing CalendarEvent create/edit/delete from CalendarClient unaffected
- [ ] `scripts/verify-phase4-rls.ts` CalendarEvent isolation test exits 0
- [ ] `scripts/verify-phase4-rls.ts` Note pipeline integration test exits 0
- [ ] `scripts/verify-phase4-rls.ts` atomicity test: forced CalendarEvent failure → Note also absent (full rollback confirmed)

### CC Prompt Outline

**Session opens with:** Read `noteActions.ts` (full), `CaseDetailClient.tsx:140-165` (note composer section), `chat/route.ts:330-440` (create_note tool + executeTool switch). Report: exact Zod schema of `createNote`, exact lines of the sidebar note composer, exact `create_note` tool args spec.

```
Model: claude-opus-4-7
Reason: Pipeline wiring across 3 files (action + component + API route); requires
judgment on tx boundary, CalendarEvent field derivation, and chat tool schema update.
Branch: phase-4b-auto-event (from main post-P4A merge)

Pre-flight reads:
  - src/actions/noteActions.ts (full — ~105 lines)
  - src/components/CaseDetailClient.tsx:130-170 (note composer + handleAddNote)
  - src/app/api/chat/route.ts:1-30 (imports) + lines around create_note tool definition
    and executeTool switch case (search for "create_note")
  - src/actions/noteActions.types.ts (created in Pillar C — confirm it exists)

Locked decisions:
  - B1: client-supplied hearingDate (ISO string, optional) — no server-side date parsing
  - B2: category picker in sidebar — dropdown first; date field renders ONLY when
    category === "Next Date" (conditional render, not always visible)
  - Pipeline fires only when BOTH category === "Next Date" AND hearingDate is present
  - CalendarEvent inserted directly in createNote withServerUserContext tx — NOT via createCalendarEvent action
  - Fetch parent Case title in same tx (reuse the ownership-check fetch) for event title
  - NOTE_CATEGORIES imported from "@/actions/noteActions.types" (not noteActions.ts) in CaseDetailClient

Hard constraints:
  - No second DB round-trip for Case title — reuse the case fetch already in createNote
  - withServerUserContext sequential awaits — no Promise.all
  - Zero schema migrations
  - Zero "any" types
  - Zod must validate hearingDate as z.string().datetime().optional() — not z.date()
    (client sends ISO string; server constructs Date object)
  - createNote return type must remain Result<T> envelope — update T to include optional eventId
  - npm run smoke:tsc clean before every commit
  - git diff before every commit (no auth bypass)

Action outline:
  1. Extend createNoteSchema in noteActions.ts with hearingDate
  2. Add CalendarEvent insert inside withServerUserContext tx in createNote
  3. Update createNote return type to Result<{ noteId: string; eventId?: string }>
  4. Update CaseDetailClient note composer: category selector + conditional date field
  5. Update chat/route.ts create_note tool args + executeTool case
  6. npm run smoke:tsc clean
  7. Add to scripts/verify-phase4-rls.ts:
     (a) CalendarEvent cross-user isolation test
     (b) Note pipeline integration test (Next Date + hearingDate → CalendarEvent in DB)
     (c) Atomicity test: force CalendarEvent insert failure (set a required field to
         null/invalid in the test call) inside tx → assert both Note row and
         CalendarEvent row are absent after the failed call (rollback confirmed)
  8. Two commits:
      - "feat(notes): createNote cascades CalendarEvent on Next Date; add category picker to sidebar"
      - "test(rls): add CalendarEvent isolation + pipeline + atomicity tests to verify-phase4-rls.ts"

DO NOT:
  - Call createCalendarEvent action from inside createNote — direct Prisma tx insert only
  - Parse dates from cleanContent string — hearingDate must come from caller
  - Add a second Case lookup for the event title — reuse the ownership-check fetch
  - Touch CalendarClient.tsx, TasksClient.tsx, caseActions.ts, taskActions.ts
  - Run prisma migrate in any form
  - Open PR — Sahil opens manually

STOP and report:
  - Both commit shas
  - Manual smoke: create "Next Date" note with date → confirm CalendarEvent in DB
  - Manual smoke: create "General Note" → confirm no CalendarEvent created
  - verify-phase4-rls.ts pipeline test result
  - Calendar page: confirm auto-event appears on correct date
```

---

## 9. Hard Constraints (Carried from Prior Phases)

1. TypeScript strict — zero `any`, zero `as any`
2. `prisma migrate dev` broken — if migration needed: `migrate diff` + `migrate deploy` only
3. `npm run prisma <subcmd>` mandatory (dotenv-cli wrapper)
4. `withServerUserContext` sequential awaits — no `Promise.all` over scoped ops
5. Auth bypass pattern never committed — `git diff` verify before every commit
6. One logical unit per commit; `npm run smoke:tsc` clean before each
7. `npm run smoke` green before every PR
8. Branch-per-pillar; one PR per pillar; squash on merge
9. ⛔ hard-stop checkpoints in every CC execution prompt
10. CC prompt format: model + reason, context, locked decisions, hard constraints, pre-flight reads, action steps with checkpoints, verification, DO NOT list, STOP and report

---

## 10. Phase 4 Close Gate

Phase 4 is **closed** when all three pillar PRs have merged to `main` and the following pass on `main`:

- [ ] `npm run smoke` exits 0 (tsc + prisma validate + rls posture + rls-runtime)
- [ ] `scripts/verify-phase4-rls.ts` exits 0 (Note + Task + CalendarEvent cross-user isolation + pipeline integration)
- [ ] Chat route: no 500 — `/api/chat` loads cleanly
- [ ] `/tasks` page: real DB data, no SEED, no TaskPriority
- [ ] Note composer: category picker functional; "Next Date" + date auto-creates CalendarEvent
- [ ] AI chat: `create_note` tool with `hearingDate` fires pipeline correctly
- [ ] Calendar page: auto-created events appear from "Next Date" notes
- [ ] No regressions on Cases, CaseDetail, Calendar CRUD, Settings

**Phase 4 opens the path to Phase 5 (Voice pipeline):** chat route live, Note action stable with category dispatch, CalendarEvent auto-creation proven, Task table DB-backed. P5 Gemini classification can route to these surfaces without building on mock data.

---

## 11. Open Decision Log (Needs Sahil Sign-Off Before Execution)

The following recommendations are documented above and need Sahil confirmation before the relevant execution session begins:

| ID | Pillar | Decision | Resolution | Status |
|----|--------|----------|-----------|--------|
| A1 | A | Legacy uplift vs. new `listAllTasks` | New `listAllTasks` — no 3.2.6 dependency | ✅ Confirmed |
| A2 | A | `priority` field: drop vs. schema add | Drop — YAGNI; `migrate dev` broken; P5 re-justifies | ✅ Confirmed |
| A3 | A | Kanban columns | 3 columns: unassigned / my-plate / associates — clerks dropped | ✅ Overridden |
| A4 | A | Global create: case required vs. read-only vs. optional caseId | Require case selection — litigation tasks are matter-bound | ✅ Confirmed |
| B1 | B | Date extraction: client-supplied vs. server-parse | Client-supplied ISO string — deterministic server action | ✅ Locked |
| B2 | B | Category picker in sidebar | Add to sidebar; date field conditional on `category === "Next Date"` | ✅ Confirmed + tightened |

---

*Plan authored 2026-06-15. No code, schema, or migration files were modified during authoring. Each pillar's full CC execution prompt is authored at the start of that pillar's dedicated session.*
