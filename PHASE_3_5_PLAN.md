# Phase 3.5 — Cases UI Hygiene Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. Read the full CC Prompt in §8 before executing — that is your actual instruction set.

**Goal:** Close 5 UI-only hygiene gaps in the Cases surface identified in the Phase 3+4 Reconciliation Audit, with zero schema migrations and zero server action rewrites.

**Architecture:** Single sub-phase (3.5.1). All changes are confined to two component files (`CasesClient.tsx`, `CaseDetailClient.tsx`) and one trivial 1-line trim in `caseActions.ts`. Three atomic commits. Blast radius is local to the Cases feature surface; no new components, no DB changes, no new actions.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Tailwind v4, Prisma `@prisma/client` (enum import only), React `useState` / `useActionState`.

---

## 1. Scope Boundary

**In scope:**
- Drop phantom `"pending"` STATUS_TAB from `CasesClient.tsx`
- Drop corresponding `pending: 0` dead field from `getCaseCounts` return shape (1-line trim — not an action rewrite)
- Fix `STATUS_OPTIONS` in `CaseDetailClient.tsx` to use enum values only (`ACTIVE | CLOSED`)
- Drop dead `matterId` + `forum` form fields from `NewMatterDialog` in `CasesClient.tsx`
- Wire `caseNumber` into CaseTile's dead Matter ID slot
- Expose all 9 Indian litigation fields in `CaseDetailClient` edit form and read-only sidebar

**Out of scope:**
- Schema migrations of any kind
- Any server action beyond the 1-line `getCaseCounts` trim
- New standalone pages, routes, or components
- `/notes` page, auto-event pipeline, chat-500 fix — all Phase 4
- Note edit capability
- `/tasks` mock — Phase 4 Pillar A
- 3.2.6 contract uplift for `calendarActions` / `taskActions` legacy half

---

## 2. Pre-conditions

- Branch `phase-3-4-reconciliation-audit` has commit `a78a1e3` (reconciliation audit) present
- `npm run smoke` green on current state
- Phase 3.0.1 confirmed closed (`be73fe6` on `main`)
- No uncommitted schema or action changes in working tree

---

## 3. Decision Log (Pre-Locked — Do Not Re-Derive)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Drop `matterId` from `NewMatterDialog` UI | `matterId` field dropped from schema in migration `20260609113647` (Phase 3.1). No schema home. `caseNumber` is the canonical replacement; it is wired in Change 4. |
| D2 | Drop `forum` from `NewMatterDialog` UI | `forum` field dropped from schema in Phase 3.1. `court` field already present in dialog (free-text court name). No functional loss. |
| D3 | Status options: `[CaseStatus.ACTIVE, CaseStatus.CLOSED]` | `updateCaseStatus` Zod accepts only `z.nativeEnum(CaseStatus)`. `"inactive"` has no enum home — selecting it always produces `{ ok: false }`. `"closed"` (lowercase) also fails because Zod expects uppercase enum key. Display: title-case via `.charAt(0).toUpperCase() + status.slice(1).toLowerCase()` mapping in the select render. |
| D4 | `getCaseCounts` `pending` field: drop from return shape | The field is `pending: 0` hardcoded (never computed from DB). Tab shows 0 always. Dropping it aligns the return type with reality. Callers: `cases/page.tsx` passes `counts` prop to `CasesClient`; `CasesClient` reads `counts.active` / `counts.closed` (pending tab uses `counts.pending`). All three references die together cleanly. |
| D5 | Indian field expansion: both edit mode and read-only sidebar | All 9 fields are in `updateCase` Zod schema in `caseActions.ts`. The edit form is the only missing link. Read-only sidebar should show the same 9 fields to make them visible before a user opens edit mode. |

---

## 4. Touch List

| File | Change | Lines affected (approx) |
|------|--------|-------------------------|
| `src/components/CasesClient.tsx` | Drop pending tab; drop matterId+forum state + inputs; wire caseNumber in tile | ~15 lines removed / ~5 modified |
| `src/components/CaseDetailClient.tsx` | Fix STATUS_OPTIONS; fix select render; add 9 Indian fields to edit form + read-only sidebar | ~90 lines added / ~10 modified |
| `src/actions/caseActions.ts` | Remove `pending: 0` from `getCaseCounts` return literal | 1 line removed |
| `src/app/(lawdger)/cases/page.tsx` | May need `counts` type update if TypeScript strict enforces shape; verify after caseActions trim | verify only; likely 0 changes |

**Files that must NOT be touched:**
- `prisma/schema.prisma`
- `prisma/migrations/`
- `src/actions/noteActions.ts`
- `src/actions/taskActions.ts`
- `src/actions/calendarActions.ts`
- `src/app/api/chat/route.ts`
- Any file outside `src/components/` and `src/actions/caseActions.ts`

---

## 5. Sub-Phase Structure

**Recommendation: Single sub-phase (3.5.1).** All 5 changes are cohesive Cases UI hygiene. Blast radius: 2 components + 1 action trim. No inter-sub-phase dependencies.

Three atomic commits within 3.5.1:

| Commit | Files | Content |
|--------|-------|---------|
| `3.5.1-a` | `CasesClient.tsx` + `caseActions.ts` + `cases/page.tsx` (if needed) | Pending tab drop + pending field trim + dead matterId/forum removal + caseNumber tile wire |
| `3.5.1-b` | `CaseDetailClient.tsx` | Status options fix (ACTIVE/CLOSED enum, title-case display, remove toUpperCase fallback) |
| `3.5.1-c` | `CaseDetailClient.tsx` | Indian field expansion (9 fields in edit form + read-only sidebar) |

Rationale for splitting 3.5.1-b and 3.5.1-c: the status fix is a 10-line targeted change; the Indian field expansion is a 90-line additive change. Separating them allows independent revert.

---

## 6. Change Specifications

### Change 1 — Drop Pending Tab Phantom

**Files:** `CasesClient.tsx` (STATUS_TABS), `caseActions.ts` (getCaseCounts return), `cases/page.tsx` (type check)

**What to do:**
- `CasesClient.tsx:51-58`: Remove the STATUS_TABS entry with `id: "pending"`. The remaining array should have only `"all"`, `"active"`, and `"closed"` entries.
- `caseActions.ts` around line 344: Remove `pending: 0` from the object returned by `getCaseCounts`. Update the inferred return type accordingly (no explicit type annotation needed — TypeScript infers from the return literal).
- `cases/page.tsx`: After the above trim, run `npm run smoke:tsc` to confirm no type error on the `counts` prop. If `CasesClient` has a typed `counts` prop interface, remove `pending` from it.

**Verify:** No "Pending" tab visible in Cases list UI. Active and Closed tabs still work.

---

### Change 2 — Inactive Status Mismatch Fix

**Files:** `CaseDetailClient.tsx`

**What to do:**
- Around line 42: Replace `STATUS_OPTIONS = ["active", "inactive", "closed"]` with `STATUS_OPTIONS = [CaseStatus.ACTIVE, CaseStatus.CLOSED] as const`. Add `import { CaseStatus } from "@prisma/client"` if not already imported (check existing imports — `MatterType` and `CaseStatus` may already be imported for `updateCase` usage).
- In the status `<select>` render (currently around lines 86-89): Remove `.toUpperCase()` call. Values sent are now already uppercase enum strings. Display label: render title-case via `status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()` for each option.
- Confirm `updateCaseStatus` is the action called from the status picker (not `updateCase`). The Zod input for `updateCaseStatus` is `z.nativeEnum(CaseStatus)` — the enum value must be passed verbatim.

**Verify:** Status dropdown shows "Active" and "Closed" only. Selecting "Active" and saving succeeds (`{ ok: true }`). No "Inactive" option in UI.

---

### Change 3 — Drop Dead matterId + forum Dialog Fields

**Files:** `CasesClient.tsx`

**What to do:**
- Remove `matterId` and `forum` state variables from `CasesClient` (declared around lines 99-101).
- Remove the corresponding `<input>` / `<select>` form elements from the `NewMatterDialog` JSX.
- Confirm the `handleCreate` submit handler (around line 175-182) already discards these — it should, per the audit comment. Remove the now-dead comment referencing them.
- Run `npm run smoke:tsc` to confirm no type errors from the state removal.

**Verify:** New Matter dialog no longer shows matterId or forum fields. Creating a new case still works.

---

### Change 4 — Wire caseNumber into CaseTile

**Files:** `CasesClient.tsx`

**What to do:**
- Around lines 457-459: Replace the hardcoded `<span className="text-lawdger-muted/70">—</span>` in the "Matter ID" or equivalent slot with `<span className="text-lawdger-muted/70">{case.caseNumber ?? "—"}</span>`. Use the exact prop name from the CaseTile component's case prop — check what field name the tile receives.
- The `caseNumber` field is returned by `getCaseWithChildren` and `listCases` — it should be available in the tile's case prop already.

**Verify:** CaseTile shows the actual `caseNumber` value for cases that have one, and "—" for cases without.

---

### Change 5 — CaseDetailClient Indian Field Expansion

**Files:** `CaseDetailClient.tsx`

**What to do:**

**5a — Edit form (around lines 183-237):** Add form fields for all 9 Indian litigation fields. Current edit form shows: title, clientName, court/forum, agreedFee, status. Add below those existing fields:

| Field | Input type | Notes |
|-------|-----------|-------|
| `caseNumber` | `<input type="text">` | Placeholder: "Court-assigned case number" |
| `caseType` | `<select>` | Options from `CASE_TYPES` imported from `caseActions.ts`. If `CASE_TYPES` is not currently exported there, the export is added in commit 3.5.1-a (trivial — prepend `export` to the const declaration). Add empty/placeholder option. |
| `matterType` | `<select>` | Options: `MatterType.LITIGATION`, `MatterType.ADVISORY`, `MatterType.PRE_LITIGATION`. Display: title-case. Import `MatterType` from `@prisma/client` if not already imported. |
| `nextHearingDate` | `<input type="date">` | Value: `toISOString().split("T")[0]` if set. Label: "Next Hearing Date". |
| `description` | `<textarea rows={3}>` | Label: "Description". |
| `filingDate` | `<input type="date">` | Label: "Filing Date". |
| `actsSections` | `<input type="text">` | Label: "Acts & Sections". Placeholder: "Pipe-delimited, e.g. IPC § 420 | CrPC § 173". |
| `firNumber` | `<input type="text">` | Label: "FIR Number". Show only when `formData.caseType === CRIMINAL_CASE_TYPE` (where `CRIMINAL_CASE_TYPE` is the exact string literal confirmed from `CASE_TYPES` at pre-flight CP1 — do not guess). |
| `policeStation` | `<input type="text">` | Label: "Police Station". Same conditional as `firNumber`. |

All 9 fields are already in the `updateCase` Zod schema in `caseActions.ts`. Pass them through the existing `handleSave` / `updateCase` call. Confirm the Zod schema accepts optional/undefined for fields left blank.

**5b — Read-only sidebar:** Add a "Case Details" or "Matter Details" section below the existing sidebar content that shows all 9 fields in read-only display. Show each field only if it has a value (guard with `?? null` and render nothing if null). Group visually:
- Legal identity: `caseNumber`, `caseType`, `matterType`
- Dates: `nextHearingDate`, `filingDate`
- Background: `description`, `actsSections`
- FIR: `firNumber`, `policeStation` (show only if `caseData.caseType === CRIMINAL_CASE_TYPE` AND either field has a value — same literal confirmed at pre-flight)

**Verify:**
- Edit mode: all 9 fields appear, values pre-populate from `caseData`, save succeeds with real values round-tripping to DB
- Read-only sidebar: fields with values show; fields without values are hidden (no empty label slots)
- Existing sidebar flows (note composer, docket tasks, status picker) unaffected

---

## 7. Hard Constraints (Carried from Prior Phases)

1. TypeScript strict — zero `any`, zero `as any`
2. No `prisma migrate dev` — if any migration were needed (it is NOT in this phase), use `migrate diff` + `migrate deploy`
3. `npm run prisma <subcmd>` mandatory (dotenv-cli wrapper for `.env.local`)
4. `withServerUserContext` sequential awaits — no `Promise.all` over scoped ops (not applicable here — no new server actions, but carry forward)
5. Auth bypass pattern never committed — `git diff` verify before every commit
6. No new `"use server"` files
7. Zod on every action input — not adding new actions, so not modifying Zod schemas, but confirm passing correct types to existing actions
8. One logical unit per commit; `npm run smoke:tsc` clean before each commit

---

## 8. Gate Criteria

Phase 3.5 is **closed** when all of the following pass:

- [ ] `npm run smoke` exits 0 (tsc + prisma validate + RLS posture)
- [ ] Manual smoke — Cases list: no "Pending" tab visible; Active/Closed tabs filter correctly
- [ ] Manual smoke — New Matter dialog: no `matterId` or `forum` fields; case creation succeeds
- [ ] Manual smoke — CaseTile: `caseNumber` shown for cases with one, `—` for cases without
- [ ] Manual smoke — Status picker: "Active" and "Closed" only; selecting either and saving succeeds; no silent `{ ok: false }`
- [ ] Manual smoke — CaseDetail edit mode: all 9 Indian fields present, values pre-populate, save round-trips correctly
- [ ] Manual smoke — CaseDetail read-only sidebar: fields with values display; no empty label slots
- [ ] Regression check — existing CaseDetail flows unaffected: note composer creates note, docket task add/toggle/delete work, archive case works

---

## 9. CC Prompt 3.5.1 (Ready to Paste)

```
## Phase 3.5.1 — Cases UI Hygiene (5 Gaps)

**Model:** claude-opus-4-7
**Reason:** Multi-file UI authoring across 3 touch points (CasesClient.tsx 712 lines,
CaseDetailClient.tsx 584 lines); requires judgment on Indian field form layout and
enum-safe status handling.

---

### Context

Phase 3.5 is a UI-only hygiene sprint. Phase 3 backend is fully done and closed.
No schema migrations. No action rewrites (one trivial 1-line trim in caseActions.ts
only). Five UI gaps from the reconciliation audit must be closed.

Codebase: Next.js 16 App Router, TypeScript strict, Tailwind v4, Prisma client.
Working dir: ~/Lawdger_MVP_v1. Branch: phase-3-5-cases-ui-hygiene (create from
phase-3-4-reconciliation-audit).

---

### Locked Decisions (do not re-derive)

- D1: Drop `matterId` from NewMatterDialog — no schema home since Phase 3.1
- D2: Drop `forum` from NewMatterDialog — `court` field is the replacement
- D3: STATUS_OPTIONS = [CaseStatus.ACTIVE, CaseStatus.CLOSED] — display title-case
  via `s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()`. Remove "inactive".
  Remove `.toUpperCase()` fallback. Values passed to updateCaseStatus are already
  uppercase enum strings.
- D4: Remove `pending: 0` from getCaseCounts return + remove pending STATUS_TAB.
  Coordinated removal — both die together.
- D5: Indian fields in both edit form AND read-only sidebar.

---

### Hard Constraints

- Zero schema migrations
- Zero new server actions
- Zero `any` or `as any`
- No `prisma migrate dev` — not applicable here but never run it
- `npm run prisma <subcmd>` if touching prisma CLI
- Auth bypass pattern must never be in the diff — `git diff` before every commit
- `npm run smoke:tsc` clean before every commit
- `npm run smoke` green before session ends
- No new files

---

### Pre-Flight Reads (read ALL before writing any code)

1. `src/components/CasesClient.tsx` — full file (712 lines)
   Focus: STATUS_TABS (around line 51-58), matterId/forum state (99-101),
   handleCreate submit (175-182), CaseTile matter ID slot (457-459)
2. `src/components/CaseDetailClient.tsx` — full file (584 lines)
   Focus: STATUS_OPTIONS (line 42), status select render (86-89),
   edit form (183-237), read-only sidebar structure
3. `src/actions/caseActions.ts` — lines 325-374
   Focus: getCaseCounts return shape (line 344), updateCase Zod schema,
   updateCaseStatus Zod schema, CASE_TYPES const if present
4. `src/app/(lawdger)/cases/page.tsx` — full file (18 lines)
   Focus: how getCaseCounts result is passed as prop to CasesClient

After reads, report in chat:
- Exact line number of `pending: 0` in getCaseCounts
- Whether CasesClient has a typed `counts` prop interface (and where)
- Whether CaseStatus and MatterType are already imported in CaseDetailClient
- Whether CASE_TYPES const exists in caseActions.ts, its exact values, and whether it is currently exported
- The exact string literal used for the criminal case type in CASE_TYPES (e.g. `"CRIMINAL"` — confirm, do not assume)

⛔ CP1 — after reads, before writing any code. Wait for "proceed."

---

### Action Steps

#### Commit 3.5.1-a — CasesClient hygiene + caseActions pending trim

Files: `src/components/CasesClient.tsx`, `src/actions/caseActions.ts`,
       `src/app/(lawdger)/cases/page.tsx` (if type update needed)

- [ ] Remove the STATUS_TABS entry with id `"pending"` from CasesClient.tsx
- [ ] Remove `pending: 0` from getCaseCounts return literal in caseActions.ts
- [ ] Remove `pending` from counts prop type in CasesClient (if typed interface exists)
- [ ] Remove `matterId` and `forum` state variables from CasesClient
- [ ] Remove matterId and forum `<input>`/`<select>` elements from NewMatterDialog JSX
- [ ] Remove dead comment referencing matterId/forum discard in handleCreate
- [ ] Wire caseNumber into CaseTile: replace hardcoded `—` span with
      `{case.caseNumber ?? "—"}` (use the actual prop field name from the tile)
- [ ] If CASE_TYPES is not currently exported from caseActions.ts, add `export`
      keyword before its const declaration (single-word change — no contract impact)
- [ ] Run `npm run smoke:tsc` — must be clean
- [ ] `git diff` — confirm no auth bypass, no schema changes
- [ ] Commit: `git commit -m "fix(ui): drop phantom pending tab, dead dialog fields; wire caseNumber in tile; export CASE_TYPES"`

⛔ CP2 — after commit 3.5.1-a. Paste tsc output + commit sha. Wait for "proceed."

---

#### Commit 3.5.1-b — CaseDetailClient status fix

File: `src/components/CaseDetailClient.tsx`

- [ ] Add `import { CaseStatus, MatterType } from "@prisma/client"` if not present
      (check existing imports first — may already be imported for updateCase call)
- [ ] Replace `STATUS_OPTIONS = ["active", "inactive", "closed"]` with
      `STATUS_OPTIONS = [CaseStatus.ACTIVE, CaseStatus.CLOSED] as const`
- [ ] In the status select render: remove `.toUpperCase()` call on value
- [ ] Display label for each option:
      `option.charAt(0).toUpperCase() + option.slice(1).toLowerCase()`
      so "ACTIVE" renders as "Active" and "CLOSED" renders as "Closed"
- [ ] Confirm the value passed to the status action is the raw enum string
      (CaseStatus.ACTIVE = "ACTIVE", CaseStatus.CLOSED = "CLOSED") — Zod expects this
- [ ] Run `npm run smoke:tsc` — must be clean
- [ ] `git diff` — confirm only CaseDetailClient.tsx touched
- [ ] Commit: `git commit -m "fix(ui): status picker — enum values, title-case display, remove inactive"`

⛔ CP3 — after commit 3.5.1-b. Paste tsc output + commit sha. Wait for "proceed."

---

#### Commit 3.5.1-c — Indian field expansion (edit form + sidebar)

File: `src/components/CaseDetailClient.tsx`

**Edit form additions** (inside the existing edit-mode form, after current fields):

Add controlled inputs for all 9 fields. Initialize their values from the
`caseData` prop passed to the component. Pass them through to `updateCase` in the
save handler. All 9 are optional in the Zod schema — blank string / undefined is fine.

Fields to add (in this order in the form):

1. `caseNumber` — `<input type="text">` — label "Case Number"
   Placeholder: "Court-assigned number (e.g. W.P. 1234/2026)"

2. `caseType` — `<select>` — label "Case Type"
   Options: `import { CASE_TYPES } from "@/actions/caseActions"` — use the
   imported const to populate options. Map each value to an `<option>`. This
   import was made exportable in commit 3.5.1-a.
   First option: `<option value="">Select type</option>`

3. `matterType` — `<select>` — label "Matter Type"
   Options: `[MatterType.LITIGATION, MatterType.ADVISORY, MatterType.PRE_LITIGATION]`
   Display: same title-case pattern as status above
   First option: `<option value="">Select type</option>`

4. `nextHearingDate` — `<input type="date">` — label "Next Hearing Date"
   Value: `caseData.nextHearingDate ? new Date(caseData.nextHearingDate).toISOString().split("T")[0] : ""`

5. `filingDate` — `<input type="date">` — label "Filing Date"
   Value: `caseData.filingDate ? new Date(caseData.filingDate).toISOString().split("T")[0] : ""`

6. `description` — `<textarea rows={3}>` — label "Description"

7. `actsSections` — `<input type="text">` — label "Acts & Sections"
   Placeholder: "Pipe-delimited, e.g. IPC § 420 | CrPC § 173"

8. `firNumber` — `<input type="text">` — label "FIR Number"
   Conditional: render only when `formData.caseType === CRIMINAL_CASE_TYPE`
   where `CRIMINAL_CASE_TYPE` is the exact string from `CASE_TYPES` confirmed
   at CP1. Derive it from the imported const (do not hardcode a guess).

9. `policeStation` — `<input type="text">` — label "Police Station"
   Same conditional as `firNumber`.

For date fields: when passing to updateCase, convert the date string back to
a Date object: `formData.nextHearingDate ? new Date(formData.nextHearingDate) : undefined`

**Read-only sidebar additions** (below existing sidebar content):

Add a "Matter Details" labelled section. Render each field only if it has a value
(`?? null` guard). Display format:

```
<div className="...">
  <h4>Matter Details</h4>
  {caseData.caseNumber && <p><span>Case No.</span>{caseData.caseNumber}</p>}
  {caseData.caseType && <p><span>Type</span>{caseData.caseType}</p>}
  {caseData.matterType && <p><span>Matter</span>{title-case matterType}</p>}
  {caseData.nextHearingDate && <p><span>Next Hearing</span>{formatted date}</p>}
  {caseData.filingDate && <p><span>Filing Date</span>{formatted date}</p>}
  {caseData.description && <p><span>Description</span>{caseData.description}</p>}
  {caseData.actsSections && <p><span>Acts & Sections</span>{caseData.actsSections}</p>}
  {(caseData.firNumber || caseData.policeStation) && (
    <>
      {caseData.firNumber && <p><span>FIR No.</span>{caseData.firNumber}</p>}
      {caseData.policeStation && <p><span>Police Station</span>{caseData.policeStation}</p>}
    </>
  )}
</div>
```

Use the same Tailwind utility classes as the rest of the sidebar for consistency
(match the `text-lawdger-muted` / `text-lawdger-foreground` / `text-sm` pattern).
For date display use `new Date(date).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })`.

- [ ] Add edit form fields (items 1-9) with controlled state
- [ ] Wire all 9 fields into the updateCase call in handleSave
- [ ] Add read-only sidebar "Matter Details" section
- [ ] Run `npm run smoke:tsc` — must be clean
- [ ] `git diff` — confirm only CaseDetailClient.tsx touched
- [ ] Commit: `git commit -m "feat(ui): expose Indian litigation fields in CaseDetail edit + sidebar"`

⛔ CP4 — after commit 3.5.1-c. Paste tsc output + commit sha.

---

### Verification

After all 3 commits:

- [ ] `npm run smoke` — must exit 0
- [ ] Dev server up: `npm run dev`
- [ ] Manual smoke — Cases list:
  - No "Pending" tab
  - Active tab filters correctly
  - Closed tab filters correctly
- [ ] Manual smoke — New Matter dialog:
  - No matterId field, no forum field
  - Submit creates case successfully
- [ ] Manual smoke — CaseTile:
  - Shows caseNumber for cases with one
  - Shows "—" for cases without
- [ ] Manual smoke — Status picker (CaseDetail):
  - Dropdown shows "Active" and "Closed" only
  - Selecting "Active" and saving → success toast / no error
  - Selecting "Closed" and saving → success toast / no error
- [ ] Manual smoke — CaseDetail edit form:
  - All 9 Indian fields visible
  - Pre-populated from existing DB values
  - Edit and save round-trips correctly (check DB via Supabase dashboard or reopen case)
- [ ] Manual smoke — CaseDetail sidebar:
  - "Matter Details" section visible
  - Fields with values shown; fields without values hidden
- [ ] Regression: note composer, docket task CRUD, archive — all unaffected

---

### DO NOT

- Run `prisma migrate` in any form
- Add new server actions or modify action Zod schemas (except the 1-line pending trim)
- Add new component files
- Touch `noteActions.ts`, `taskActions.ts`, `calendarActions.ts`, `chat/route.ts`
- Touch anything in `prisma/` or `scripts/`
- Inline CASE_TYPES in the component — it must be imported from `caseActions.ts`
- Hardcode the CRIMINAL string — derive it from the imported `CASE_TYPES` const
- Commit with `any` types or `.toUpperCase()` status hack
- Skip checkpoints
- Open a PR — Sahil opens manually

---

### STOP and Report

After `npm run smoke` green and all manual smoke items checked:
- All 3 commit shas
- `npm run smoke` output (last 5 lines)
- Any field that behaved unexpectedly during manual smoke
- Confirm branch is `phase-3-5-cases-ui-hygiene` (NOT `phase-3-4-reconciliation-audit`)
- Verdict: "Phase 3.5 gate PASS" or specific item that failed
```

---

*Plan authored 2026-06-15. No code or schema files were modified during authoring. Execution branch: `phase-3-5-cases-ui-hygiene` (create from `phase-3-4-reconciliation-audit` at execution time).*
