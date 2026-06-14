# Phase 3 + 4 Reconciliation Audit

**Branch:** `phase-3-4-reconciliation-audit`
**Date:** 2026-06-15
**Auditor:** Claude Code (Sonnet 4.6) — read-only pass
**Scope:** Cases (P3), Notes (P4), Tasks (P4), Calendar (P4)
**Out of scope:** Voice/Gemini (P5), Legal Brain RAG (P6), Finances (P7), Search (P7)

---

## 1. Executive Summary

| Phase / Area | Code State | Contract | Gate |
|---|---|---|---|
| P3 Cases | PARTIAL (5 UI-hygiene gaps — all backend DONE) | COMPLIANT | MERGEABLE |
| P4 Notes | PARTIAL (no Postgres enum, no /notes page, no note edit, chat-500) | COMPLIANT | BLOCKED |
| P4 Tasks | PARTIAL (/tasks is 100% mock, legacy action half non-compliant) | DRIFT | BLOCKED |
| P4 Calendar | PARTIAL (auto-event pipeline absent, contract uplift pending) | DRIFT | BLOCKED |

**Top 3 gaps:**
1. `/tasks` global page is 100% mock (`SEED` constant, no DB call, no server props) — biggest P4 lie.
2. Auto-event-from-date pipeline is entirely absent — `createNote(category="Next Date")` creates only the note; no `CalendarEvent` auto-created anywhere.
3. Chat-route 500 still live — `type NoteCategory` re-export from `"use server"` file blocks the AI assistant from loading.

**Three forward options (neutral — trade-offs only):**
- **(a) P3 closed, P3.5 hygiene sprint, then P4 fresh plan:** cleanest separation, two small PRs, but adds a phase boundary overhead before P4 work can start.
- **(b) Single P3+P4 reconciliation phase:** fewest context switches; ship one PR that kills mock, wires /tasks, adds auto-event pipeline, fixes chat-500, and cleans inactive status. Risk: larger blast radius, harder to gate.
- **(c) Skip to P5, P3/P4 gaps as parallel hygiene PRs:** fastest path to Voice pipeline demo; risk is that /tasks mock and chat-500 remain live while P5 builds on them, creating a compounding tech-debt surface.

---

## 2. Cases (P3) State

### 2a. Server Actions — `src/actions/caseActions.ts` (374 lines)

All 9 actions present, fully compliant with 3.2 contract (Zod + `getServerUser` + scoped Prisma + `where: { userId }` + `Result<T>`):

| Action | Status | Location |
|---|---|---|
| `listCases` | ✅ DONE | caseActions.ts:155 |
| `createCase` | ✅ DONE | caseActions.ts:127 |
| `getCase` | ✅ DONE | caseActions.ts:195 |
| `getCaseWithChildren` | ✅ DONE | caseActions.ts:219 |
| `updateCase` | ✅ DONE | caseActions.ts:246 |
| `updateCaseStatus` | ✅ DONE | caseActions.ts:289 |
| `archiveCase` | ✅ DONE | caseActions.ts:319 |
| `getCaseCounts` | ✅ DONE | caseActions.ts:325 |
| `deleteCase` | ✅ DONE | caseActions.ts:350 |

### 2b. Pages and Components

| File | Status | Notes |
|---|---|---|
| `cases/page.tsx` | ✅ DONE | Calls `listCases` + `getCaseCounts` server actions; thin wrapper |
| `CasesClient.tsx` | ✅ DONE | Receives real DB data via props; renders CaseTiles from real cases |
| `cases/[id]/page.tsx` | ✅ DONE | Calls `getCaseWithChildren`; timeline wired to real notes+tasks+events |
| `CaseDetailClient.tsx` | 🟡 PARTIAL | Note composer + task CRUD wired to real DB; sidebar edit missing 8 fields; status picker has "inactive" bug (see UI gaps) |

### 2c. RLS Isolation Gate

- `Case` table: ✅ `ENABLE ROW LEVEL SECURITY` (migration `20260527051415`)
- `Case` table: ✅ `FORCE ROW LEVEL SECURITY` (migration `20260612204242`)
- Policy: `Case_isolation` — `USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))` — ✅ correct NULLIF guard
- Verify script coverage: `scripts/verify-phase32-rls.ts` covers 5 Case-table checks (getCase pattern, getCaseWithChildren, updateCase owner-check, updateCaseStatus owner-check, deleteCase). ✅

### 2d. UI-Hygiene Gaps (5 confirmed still present)

1. **Pending tab phantom** — `CasesClient.tsx:51-58` defines `STATUS_TABS` with id `"pending"`. `getCaseCounts` returns `pending: 0` always (caseActions.ts:344 comment: `// TODO(3.3): drop phantom pending field`). Tab is visible, always shows 0 matches.

2. **Inactive status mismatch** — `CaseDetailClient.tsx:42`: `STATUS_OPTIONS = ["active", "inactive", "closed"]`. `updateCaseStatus` Zod schema validates against `z.nativeEnum(CaseStatus)` which only accepts `ACTIVE | CLOSED`. Selecting "inactive" and saving calls `info.status.toUpperCase()` → `"INACTIVE"` which fails Zod validation. CaseDetailClient.tsx:86-89 comment documents this: `"inactive" has no enum home and will produce { ok: false }`.

3. **Dead form fields matterId + forum** — `CasesClient.tsx:99-101` collects `matterId` and `forum` state. `CasesClient.tsx:175-182` comment: `"matterId/forum dropped at the schema level in 3.1; dialog still collects them for layout but they're discarded here"`. Fields shown in UI, values silently dropped on submit.

4. **Dead CaseTile Matter ID slot** — `CasesClient.tsx:457-459`: `"matterId column dropped in phase 3.1; caseNumber wiring is phase 3.4"`. Tile renders `<span className="text-lawdger-muted/70">—</span>` unconditionally. `caseNumber` field exists in DB and `getCaseWithChildren` returns it, but tile ignores it.

5. **CaseDetailClient sidebar missing 8 fields** — Edit mode (`CaseDetailClient.tsx:183-237`) offers: title, clientName, court/forum, agreedFee, status. Not offered: `caseNumber`, `matterType`, `caseType`, `nextHearingDate`, `description`, `filingDate`, `actsSections`, `firNumber`, `policeStation`. All 9 are in schema and caseActions.ts Zod schema. Read-only sidebar shows none of them either.

---

## 3. Notes (P4) State

### 3a. Schema Model

`Note` model (schema.prisma:73-84):
- Fields: `id`, `caseId` (FK → Case), `userId` (FK → User), `rawTranscript String?`, `cleanContent String`, `category String`, `createdAt`, `updatedAt`
- ✅ Model exists, caseId FK present, rawTranscript present

### 3b. NoteCategory Enum

❌ **MISSING from Postgres schema.** Roadmap specifies "Notes timeline with category enum."

Reality: `category` column is `String` in schema.prisma:79. The "enum" is a TypeScript const in `noteActions.ts:25-30`:
```ts
export const NOTE_CATEGORIES = ["General Note", "Client Update", "Next Date", "Task"] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];
```
No `CREATE TYPE notecategory AS ENUM (...)` in any migration. Values are validated at the app layer (Zod enum from the TS const), not at the DB layer. This matches roadmap intent functionally but not structurally (no DB-level enum constraint).

### 3c. RLS

- ✅ `ENABLE ROW LEVEL SECURITY` on `Note` (migration `20260527051415`)
- ✅ `FORCE ROW LEVEL SECURITY` on `Note` (migration `20260612204242`)
- Policy: `Note_isolation` — NULLIF-guarded GUC pattern — ✅
- ⚠️ **Verify-script gap:** Neither `verify-isolation.ts` nor `verify-phase32-rls.ts` covers Note table. Note RLS correctness is proven by migration SQL only, not by a runtime cross-user test.

### 3d. Server Actions — `src/actions/noteActions.ts` (105 lines)

| Function | Status | Contract |
|---|---|---|
| `createNote` | ✅ DONE | Zod + `getServerUser` + scoped Prisma + parent-case ownership check + `Result<T>` |
| `deleteNote` | ✅ DONE | Zod + `getServerUser` + scoped Prisma + `Result<T>` |

No `updateNote` (no edit capability exists anywhere). No `listNotes` standalone action (notes fetched via `getCaseWithChildren`).

### 3e. Note Creation UI

✅ In `CaseDetailClient.tsx:146-158` as "Quick Case Notes" sidebar composer. Calls `createNote({ caseId, cleanContent, category: "General Note" })`. Category is **hardcoded to "General Note"** — user cannot select category from the sidebar. Other categories ("Client Update", "Next Date", "Task") only reachable via AI chat tool.

### 3f. Note Timeline Display

✅ `cases/[id]/page.tsx:32` and `42-47`: `manualNotes = caseData.notes` pulled from `getCaseWithChildren` (real DB). Timeline renders notes with category color coding (CATEGORY_COLOR map at line 14-19). Wired to real DB, not mock.

### 3g. Editable AI-Generated Notes

❌ MISSING. No `updateNote` action exists. No edit UI for any note. Notes are create-only; once written, immutable from the UI. Voice-generated notes (with `rawTranscript`) are displayed in a collapsed "Voice Archive" section (cases/[id]/page.tsx:233-269) — display only, no edit.

### 3h. Standalone Notes Page

❌ ABSENT. No `/notes` route exists. No `src/app/(lawdger)/notes/` directory. Notes are only accessible within a Case's detail page.

### 3i. Chat-Route 500 Bug

⚠️ **CONFIRMED STILL PRESENT.**

`src/app/api/chat/route.ts:14`:
```ts
import { createNote, type NoteCategory } from "@/actions/noteActions";
```

`noteActions.ts` is marked `"use server"` (line 1). Under Next.js 16 + Turbopack, importing anything (even a `type`) from a `"use server"` file into a non-`"use server"` context (a regular API route) causes a module-load 500: `"use server" file can only export async functions, found object`.

The `NoteCategory` type is used in `route.ts:337` as the type for `args.category`. Fix: move `NoteCategory` type to a non-`"use server"` file. SOT §10 documents this with the same root cause.

---

## 4. Tasks (P4) State

### 4a. Schema Model

`Task` model (schema.prisma:86-98):
- Fields: `id`, `caseId` (FK → Case), `userId` (FK → User), `description String`, `status String` (default "pending"), `assignee String` (default "Unassigned"), `dueDate DateTime?`, `createdAt`, `updatedAt`
- ✅ caseId FK present (case linkage exists in schema)
- ❌ No `priority` field in schema. `TaskPriority = "urgent" | "normal" | "low"` exists only as a local TypeScript type in `TasksClient.tsx:55` — never persisted to DB.
- ❌ No formal `status` enum in Postgres. Status is a free string "pending" | "completed" validated only at app layer.

### 4b. RLS

- ✅ `ENABLE ROW LEVEL SECURITY` on `Task` (migration `20260527051415`)
- ✅ `FORCE ROW LEVEL SECURITY` on `Task` (migration `20260612204242`)
- ⚠️ **Verify-script gap:** No isolation script covers Task table.

### 4c. Server Actions — `src/actions/taskActions.ts` (255 lines)

**SPLIT CONTRACT — TWO TIERS IN ONE FILE:**

| Function | Tier | Contract Status |
|---|---|---|
| `getTasks` | Legacy | ❌ bare `prisma` + `requireUserId`, throws, no Zod, no Result |
| `createTask` | Legacy | ❌ bare `prisma` + `requireUserId`, throws, no Zod, no Result |
| `updateTask` | Legacy | ❌ bare `prisma` + `requireUserId`, throws, no Zod, no Result |
| `updateTaskStatus` | Legacy | ❌ bare `prisma` + `requireUserId`, throws, no Zod, no Result |
| `updateTaskAssignee` | Legacy | ❌ bare `prisma` + `requireUserId`, throws, no Zod, no Result |
| `getTasksWithDueDate` | Legacy | ❌ bare `prisma` + `requireUserId`, throws, no Zod, no Result |
| `deleteTask` | Legacy | ❌ bare `prisma` + `requireUserId`, throws, no Zod, no Result |
| `createCaseTask` | Phase 3.2 | ✅ Zod + scoped Prisma + `getServerUser` + Result<T> |
| `toggleCaseTaskStatus` | Phase 3.2 | ✅ Zod + scoped Prisma + `getServerUser` + Result<T> |
| `deleteCaseTask` | Phase 3.2 | ✅ Zod + scoped Prisma + `getServerUser` + Result<T> |

File header (taskActions.ts:8-16) documents this split and names the uplift as `3.2.6`.

### 4d. Global Task List Page (`/tasks`)

❌ **FULLY MOCK. Not wired to DB.**

`tasks/page.tsx` (5 lines):
```tsx
export default function TasksPage() {
  return <TasksClient />;
}
```
No server-side data fetch. No props passed. `TasksClient` accepts no props.

`TasksClient.tsx:95-221`: `const SEED: ItemsState = { unassigned: [...], "my-plate": [...], associates: [...], clerks: [...] }` — 8 hardcoded fake tasks with fake caseIds (`"c-reliance"`, `"c-sharma"`, `"c-techcorp"`, etc.). Component initializes: `const [items, setItems] = useState<ItemsState>(SEED)`.

All Kanban create/edit/delete operations (handleSave, handleDelete, handleQuickAdd) mutate local state only — no server action calls. The global task page is a fully interactive UI demo with zero DB connectivity.

### 4e. Case-Linked Tasks (in CaseDetail)

✅ WIRED to real DB. `CaseDetailClient.tsx` calls:
- `createCaseTask` (3.2-compliant) on "Add to Docket" (line 125-129)
- `toggleCaseTaskStatus` (3.2-compliant) on checkbox click (line 392)
- `deleteCaseTask` (3.2-compliant) on trash icon (line 407)

Tasks shown in sidebar docket are pulled from `getCaseWithChildren` → `caseData.tasks` (real DB).

### 4f. Overdue Detection

✅ Logic exists — **client-side derived, not server-computed.** Three locations:
- `TasksClient.tsx:677-678`: `pending.filter((t) => t.dueDate && isPast(t.dueDate) && !isToday(t.dueDate))` — stats tile "Overdue" count (but only operates on mock SEED data, so meaningless)
- `CaseDetailClient.tsx:140`: `if (isPast(date)) return { label: "Overdue", cls: "text-red-600..." }` — due label on case docket tasks (real DB data)
- `CalendarClient.tsx:175`: `const isTaskOverdue = (dueDate: Date) => !isToday(dueDate) && isPast(dueDate)` — calendar overdue chip (real DB data via getTasksWithDueDate)

### 4g. Mock Data Status

❌ NOT KILLED. `SEED` constant at `TasksClient.tsx:102-221` is live and is the only data source for the global `/tasks` page.

### 4h. Auto-Task-Creation from Voice

❌ ABSENT. The AI chat (`chat/route.ts`) can create tasks via the `create_task` tool through explicit user instruction, but there is no automatic task creation triggered by voice classification. That is P5 territory and correctly absent.

---

## 5. Calendar (P4) State

### 5a. Schema Model

`CalendarEvent` model (schema.prisma:100-111):
- Fields: `id`, `caseId` (FK → Case), `userId` (FK → User), `title String`, `hearingDate DateTime`, `description String?`, `createdAt`, `updatedAt`
- ✅ caseId FK present
- ❌ No `eventType` enum in schema. Roadmap specifies an event-type enum; absent.

### 5b. RLS

- ✅ `ENABLE ROW LEVEL SECURITY` on `CalendarEvent` (migration `20260527051415`)
- ✅ `FORCE ROW LEVEL SECURITY` on `CalendarEvent` (migration `20260612204242`)
- ⚠️ **Verify-script gap:** No isolation script covers CalendarEvent table.

### 5c. Server Actions — `src/actions/calendarActions.ts` (99 lines)

| Function | Status | Contract |
|---|---|---|
| `getCalendarEvents` | ✅ DONE | Scoped Prisma (getServerScopedPrisma). `requireUserId` — NOT `getServerUser`. No Zod. No Result<T>. |
| `createCalendarEvent` | ✅ DONE | `withServerUserContext` tx + case ownership check. `requireUserId`. No Zod. No Result<T>. |
| `updateCalendarEvent` | ✅ DONE | Scoped Prisma + `where: { id, userId }`. `requireUserId`. No Zod. No Result<T>. Throws on not-found. |
| `deleteCalendarEvent` | ✅ DONE | Scoped Prisma + `where: { id, userId }`. `requireUserId`. No Zod. No Result<T>. Throws on not-found. |
| `getCasesForSelect` | ⚠️ BROKEN | Filters `status: "ACTIVE"` as string literal — should be `CaseStatus.ACTIVE` enum. Works at runtime (Prisma accepts string for enum fields) but is not type-safe and bypasses TS strict. Also returns zero results if case status was stored differently. |

Contract state: **DRIFT from 3.2 contract.** All functions use `requireUserId` instead of `getServerUser`. No Zod schemas. No `Result<T>` envelopes. SOT §6 documents this, uplift sequenced to 3.2.6.

### 5d. Calendar UI Page

✅ **WIRED to real DB.** `calendar/page.tsx:1-23` calls three server functions:
- `getCalendarEvents()` → real hearings from DB
- `getCasesForSelect()` → real case list for "Linked Case" dropdown
- `getTasksWithDueDate()` → real pending tasks with due dates (legacy `requireUserId` path)

`CalendarClient` is a fully functional calendar (day/week/month views, drag-to-reschedule, create/edit/delete modals) driven by real DB data. This is the most complete P4 deliverable.

### 5e. Auto-Event-from-Date Pipeline

❌ **ABSENT — P4 cornerstone gap.**

The P4 spec: "when a Note with category=Next Date is created, auto-create a CalendarEvent."

Code trace:
- `noteActions.ts:createNote` (line 41-77): creates the note, calls `revalidatePath`. No CalendarEvent creation. No date parsing from `cleanContent`. Returns `{ id: note.id }`.
- `CaseDetailClient.tsx:handleAddNote` (line 151-158): calls `createNote({ caseId, cleanContent, category: "General Note" })`. Always hardcoded "General Note" — never "Next Date" from sidebar.
- `chat/route.ts:executeTool` case `"create_note"` (line 419-427): calls `createNote` only. No follow-up `createCalendarEvent` call.
- No trigger, hook, or DB function exists to auto-create a CalendarEvent on Note insert.

The pipeline is **fully absent.** When AI classifies a voice note as "Next Date," it can call `create_hearing` directly (it has that tool), but there is no automatic coupling between Note creation and CalendarEvent creation.

### 5f. Missed Date Alerts

❌ ABSENT as a server-side feature. Client-side overdue coloring exists in CalendarClient (`OVERDUE_COLOR` class at line 43; `isTaskOverdue` at line 175). No server-side push notifications, badges, or alert system.

---

## 6. Cross-Cutting

### 6a. RLS Posture

All 7 application tables have both ENABLED and FORCE RLS as of migration `20260612204242`:

| Table | RLS ENABLED | FORCE | Policy | Verify Script |
|---|---|---|---|---|
| `User` | ✅ | ✅ | `User_self_select`, `User_self_update` (2 policies) | None (auth RPC path) |
| `Case` | ✅ | ✅ | `Case_isolation` | ✅ verify-isolation.ts, verify-phase32-rls.ts |
| `Note` | ✅ | ✅ | `Note_isolation` | ❌ MISSING |
| `Task` | ✅ | ✅ | `Task_isolation` | ❌ MISSING |
| `CalendarEvent` | ✅ | ✅ | `CalendarEvent_isolation` | ❌ MISSING |
| `Payment` | ✅ | ✅ | `Payment_isolation` | ❌ MISSING |
| `Document` | ✅ | ✅ | `Document_isolation` | ❌ MISSING |
| `_prisma_migrations` | ✅ | ❌ (deliberate) | None (default deny) | N/A |

**Gap:** 5 of 7 app tables have no runtime cross-user isolation test. Only `Case` is covered by verify scripts. `smoke:rls-runtime` (`check-rls-runtime.ts`) verifies policy *existence* and FORCE state but does not run cross-user read/write tests for Note, Task, CalendarEvent, Payment, or Document.

### 6b. SOT Accuracy

| Section | Status | Discrepancy |
|---|---|---|
| §6 RLS posture table | ✅ Accurate | Matches migration SQL |
| §6 Action File Migration State | ✅ Accurate | taskActions partial, calendarActions scoped-only, caseActions/noteActions compliant — all correct |
| §10 Known Tech Debt — chat-route 500 | ✅ Accurate | Still present, cited correctly |
| §10 Known Tech Debt — taskActions legacy half | ✅ Accurate | Uplift sequenced to 3.2.6 |
| §13 Phase Roadmap — "3.3+" deferred | ⚠️ STALE | SOT lists "CaseDetail real data" as deferred under "3.3+". CaseDetail IS real data as of current codebase (`getCaseWithChildren` wired). Minor SOT drift. |
| NoteCategory as Postgres enum | ⚠️ NOT DOCUMENTED | Roadmap implies DB enum; actual implementation is TS const + String column. Gap not documented in SOT. |
| /tasks global page mock state | ⚠️ NOT DOCUMENTED | SOT does not note that the global /tasks page remains fully mock. |

### 6c. Indian Litigation Field Completeness

All 9 fields confirmed present across schema, migration, and caseActions Zod schema:

| Field | Schema | caseActions Zod | Notes |
|---|---|---|---|
| `caseNumber` | ✅ | ✅ | Added in migration `20260609113647` |
| `caseType` | ✅ | ✅ | String; CASE_TYPES const; enum in caseActions.ts |
| `matterType` | ✅ | ✅ | `MatterType` Prisma enum: LITIGATION, ADVISORY, PRE_LITIGATION |
| `nextHearingDate` | ✅ | ✅ | DateTime? |
| `description` | ✅ | ✅ | String? |
| `filingDate` | ✅ | ✅ | DateTime? (added in 20260527051415) |
| `actsSections` | ✅ | ✅ | String? (pipe-delimited per SOT) |
| `firNumber` | ✅ | ✅ | String? |
| `policeStation` | ✅ | ✅ | String? |

❌ **CaseDetailClient sidebar does NOT expose any of these 9 fields** for viewing or editing. Data exists in DB and actions support writes; UI is the missing link.

---

## 7. Phase Status Conclusions

### Phase 3 — Cases

- **Code state:** PARTIAL (5 UI-hygiene gaps; all backend logic DONE)
- **Contract state:** COMPLIANT — `caseActions.ts` is gold-standard 3.2 pattern; `noteActions.ts` follows same; case-scoped task actions follow same
- **Gate readiness:** MERGEABLE as-is. Backend is production-ready. UI gaps are cosmetic (misleading tab, dead form fields, missing edit fields) but non-blocking for functional use.

### Phase 4 — Notes

- **Code state:** PARTIAL — create/delete actions done, timeline display done, no standalone page, no note edit, no Postgres enum, chat-route 500 present
- **Contract state:** COMPLIANT — noteActions.ts follows 3.2 pattern
- **Gate readiness:** BLOCKED on: (1) auto-event pipeline (P4 cornerstone), (2) chat-route 500 (blocks AI assistant), (3) note edit capability

### Phase 4 — Tasks

- **Code state:** PARTIAL — case-scoped task CRUD wired; global /tasks page is 100% mock; priority not in schema
- **Contract state:** DRIFT — legacy half (7 functions) uses bare prisma + requireUserId, no Zod, no Result<T>
- **Gate readiness:** BLOCKED on: (1) kill SEED mock, wire /tasks page to DB, (2) legacy action uplift (3.2.6), (3) decide whether priority + column belong in schema

### Phase 4 — Calendar

- **Code state:** PARTIAL — calendar UI wired to real DB, but auto-event pipeline absent, no event-type enum, no server-side alerts
- **Contract state:** DRIFT — no Zod, no Result<T>, requireUserId instead of getServerUser; getCasesForSelect string/enum type drift
- **Gate readiness:** BLOCKED on: (1) auto-event-from-date pipeline (P4 cornerstone), (2) contract uplift (3.2.6)

---

### Three Forward Options

**(a) Close P3 → scope P3.5 hygiene sprint → then scope genuine P4 work**

P3 declared done (backend complete). A minimal P3.5 hygiene PR fixes: pending tab, inactive status picker, dead matterId/forum dialog fields, CaseTile caseNumber wiring, and CaseDetailClient Indian field exposure. Then a fresh P4 plan scoped around three pillars: (1) kill /tasks mock + wire to DB, (2) auto-event pipeline, (3) fix chat-500 + note type. Clean phase boundaries. Two small PRs before any P4 code. Risk: adds ~1 planning overhead session before any P4 execution.

**(b) Single P3+P4 reconciliation phase — one PR, both phases**

Merge all residual P3 and P4 gaps into one reconciliation PR: kill /tasks mock, wire /tasks to DB, auto-event pipeline, fix chat-500, fix inactive status, wire CaseTile caseNumber, expose Indian fields in CaseDetailClient sidebar, uplift calendarActions/taskActions legacy half (3.2.6). Fewest context switches, one gate. Risk: large blast radius (7-8 files across UI + actions + schema), harder to isolate regressions, requires schema migration for priority if added to Task.

**(c) Skip to P5 (Voice pipeline), P3/P4 gaps as parallel hygiene PRs**

Start P5 voice capture immediately. Open two parallel tickets: "P3 UI hygiene" and "P4 wiring." Risk: P5 builds on /tasks mock (voice will eventually write to the same Task table), chat-route 500 blocks the AI assistant which is P5-adjacent, and the auto-event pipeline is precisely what P5 voice classification would trigger. High coupling risk — fixing the pipeline mid-P5 could break in-flight P5 code.

---

## 8. Open Issues (Out of Scope — Log Only)

| # | Severity | Location | Description |
|---|---|---|---|
| 1 | 🔴 HIGH | `src/app/api/chat/route.ts:14` | Chat-route 500: `import { createNote, type NoteCategory } from "@/actions/noteActions"` — type re-export from `"use server"` file causes module-load error under Next.js 16 + Turbopack. AI assistant unreachable. Fix: move `NoteCategory` type to `src/actions/noteActions.types.ts`. |
| 2 | 🔴 HIGH | `src/components/CaseDetailClient.tsx:42,96` | Inactive status runtime failure: `STATUS_OPTIONS = ["active", "inactive", "closed"]` but `updateCaseStatus` Zod accepts only `CaseStatus` enum (`ACTIVE\|CLOSED`). Selecting "inactive" + saving returns `{ ok: false }` silently. |
| 3 | 🟡 MEDIUM | `src/actions/taskActions.ts:28-150` | Legacy task action half (7 functions): bare `prisma` + `requireUserId`, no Zod, no Result<T>. Under FORCE RLS these may silently return empty sets or throw if GUC not set. Contract uplift sequenced to 3.2.6. |
| 4 | 🟡 MEDIUM | `src/actions/calendarActions.ts` (all) | calendarActions contract drift: no Zod, no Result<T>, `requireUserId` instead of `getServerUser`. Uplift sequenced to 3.2.6. |
| 5 | 🟡 MEDIUM | `src/actions/calendarActions.ts:95` | `getCasesForSelect` filters `where: { userId, status: "ACTIVE" }` — string literal, not `CaseStatus.ACTIVE` enum. Functionally equivalent at runtime but violates TypeScript strict intent. |
| 6 | 🟡 MEDIUM | `scripts/verify-isolation.ts`, `scripts/verify-phase32-rls.ts` | Both scripts cover Case table only. Note, Task, CalendarEvent, Payment, Document tables have no runtime cross-user isolation test. `smoke:rls-runtime` verifies policy existence + FORCE state but not data isolation for 5 of 7 app tables. |
| 7 | 🟢 LOW | `src/components/CasesClient.tsx:99-101,175-182` | Dead form fields `matterId` + `forum` collected in NewMatterDialog state but silently discarded on submit. UI shows fields, users fill them, data is lost. |
| 8 | 🟢 LOW | `SOURCE_OF_TRUTH.md:§13` | SOT Phase Roadmap lists "CaseDetail real data" under "3.3+ Deferred". CaseDetail IS real data now (getCaseWithChildren wired). Minor SOT drift — should be updated to "✅ Done". |
| 9 | 🟢 LOW | `prisma/seed.ts` (SOT-documented) | `update: {}` on upsert means re-seeding does not refresh password. RLS bypass requires `DATABASE_URL` override at seed time. Both documented in SOT §10 — logging here for completeness. |
| 10 | 🟢 LOW | No AUTH_BYPASS in git log | `git log -S "AUTH_BYPASS"` returned no results. Clean. |
| 11 | 🟢 LOW | No `: any` / `as any` in `src/` | Grep returned zero results. TS strict compliance confirmed. |

---

## 9. Files Inspected

| File | Lines |
|---|---|
| `prisma/schema.prisma` | 142 |
| `prisma/migrations/0_init/migration.sql` | (full read) |
| `prisma/migrations/20260527051415_add_documents_litigation_rls/migration.sql` | (full read) |
| `prisma/migrations/20260612204242_phase_3_0_1a_lawdger_app_grants_and_force_rls/migration.sql` | (full read) |
| `src/actions/caseActions.ts` | 374 |
| `src/actions/noteActions.ts` | 105 |
| `src/actions/taskActions.ts` | 255 |
| `src/actions/calendarActions.ts` | 99 |
| `src/components/CasesClient.tsx` | 712 |
| `src/components/CaseDetailClient.tsx` | 584 |
| `src/components/TasksClient.tsx` | 1305 |
| `src/components/CalendarClient.tsx` | 730 |
| `src/app/(lawdger)/cases/page.tsx` | 18 |
| `src/app/(lawdger)/cases/[id]/page.tsx` | 289 |
| `src/app/(lawdger)/tasks/page.tsx` | 5 |
| `src/app/(lawdger)/calendar/page.tsx` | 23 |
| `src/app/api/chat/route.ts` | 587 |
| `scripts/verify-isolation.ts` | 135 |
| `scripts/verify-phase32-rls.ts` | 149 |
| `SOURCE_OF_TRUTH.md` | 350 |
| **Total lines read** | **~5,862** |

---

*Audit complete. No code, schema, or migration files were modified. Branch: `phase-3-4-reconciliation-audit`. All findings are read-only observations.*
