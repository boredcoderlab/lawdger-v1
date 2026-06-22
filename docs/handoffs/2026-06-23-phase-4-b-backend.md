# Phase 4 Pillar B — backend handoff

**Date:** 2026-06-23
**Milestone:** Pillar B backend (B.1 + B.2) closed
**PR:** [#19](https://github.com/boredcoderlab/lawdger-v1/pull/19) — `Phase 4 Pillar B — auto-event pipeline (B.1+B.2 backend)`
**Squash SHA:** `f1d43c5`
**Main HEAD after SOT flip:** `68af63c`

---

## 1. Surface area

### Files changed (8)

| Path | Status | Lines |
|---|---|---|
| `prisma/schema.prisma` | modified | +6 / −6 |
| `prisma/migrations/20260622000000_phase_4_b_auto_event_pipeline/migration.sql` | new | +9 |
| `src/actions/noteActions.ts` | modified | +75 / −22 |
| `src/actions/calendarActions.ts` | modified | +2 / −0 |
| `src/app/api/chat/route.ts` | modified | +7 / −0 |
| `src/lib/date.ts` | new | +20 |
| `scripts/verify-pillar-b-rls.ts` | new | +186 |
| `scripts/check-rls-runtime.ts` | modified | +1 / −0 |
| **Total** | — | **+306 / −28** |

### Schema deltas (additive, nullable, no backfill)

```sql
ALTER TABLE "Note" ADD COLUMN "nextDate" TIMESTAMP(3);
ALTER TABLE "CalendarEvent" ADD COLUMN "noteId" TEXT;
CREATE UNIQUE INDEX "CalendarEvent_noteId_key" ON "CalendarEvent"("noteId");
```

- Migration checksum (SHA-256): `6a2aff8b4daa5adcbc8d7506786761a15acf019b191d3e06023cd2fa40b2bca6`
- `_prisma_migrations` row id: `53d7eb8a-c7f9-4f41-825a-7e4f126b9c15`
- Applied via Supabase MCP `apply_migration` (the broken `20260609030200` migration prevents `prisma migrate dev`).
- RLS policies on both tables unchanged — nullable additive columns covered by existing `userId`-keyed isolation.

### Smoke baseline post-merge

- `smoke:tsc` clean.
- `smoke:prisma` valid.
- `smoke:rls` — 8 tables verified.
- `smoke:rls-runtime` — **27/27 PASS** (was 22 pre-merge). Breakdown: `verify-isolation` 4 + `verify-phase32-rls` 6 + `verify-with-user-context` 5 + `verify-phase4-rls` 7 + `verify-pillar-b-rls` 5 = 27.

### Behavioural deltas

- **`createNote`:** if `category === "Next Date"` AND `nextDate >= startOfTodayIST()`, auto-creates a linked `CalendarEvent` inside the same RLS-scoped interactive transaction. Note write commits with `nextDate` field set regardless of event branch.
- **`deleteNote`:** cascades event-then-note in one tx (events first, then note). `revalidatePath("/calendar")` added.
- **`createCalendarEvent`:** signature gains optional `noteId?: string` (backward compatible). `createNote` does NOT use this action — it issues `tx.calendarEvent.create` inline for atomicity.
- **Gemini `create_note` tool:** optional `nextDate` param, description `"ISO 8601 date (YYYY-MM-DD) extracted from user input. Include ONLY when category is 'Next Date' AND user mentioned a specific date. Omit otherwise."` `z.coerce.date()` handles string → Date server-side.

---

## 2. Discipline notes — finding + rule

### Surface-before-fix — atomicity (CP4 pre-edit)

**Finding.** `getServerScopedPrisma()` returns a Prisma client extension where each operation opens its own `$transaction([set_config, query])`. Sibling writes against the same `db` instance do NOT share a transactional envelope — they commit independently. Sequential `db.note.create` then `db.calendarEvent.create` would leave an orphan note if the event create failed mid-flight. Surfaced before any CP4 edit; user locked Option A (upgrade `createNote` to `withServerUserContext`).

**Rule.** When a CP requires multi-write atomicity, verify the `getServerScopedPrisma` vs `withServerUserContext` distinction at pre-flight by quoting `src/lib/prisma-rls.ts:36–89`. Never assume the existing scoped-prisma pattern is transactional just because the helper name has "scoped" in it.

### Surface-before-fix — email casing (CP7 pre-edit)

**Finding.** CP7 instructions said use "`userA@test.local` and `userB@test.local`, both lowercase per A.4 carry-forward fix." But the seed file (`prisma/seed.ts:20–21`) defines USER_A as `jainsahil2897@gmail.com` — there is no `usera@test.local`. The A.4 lowercase carry-forward applies only to user B (the RPC `auth_find_user_by_email` lowercase-normalizes input). Surfaced before authoring the verify script; user confirmed the misspoken instruction and to mirror `verify-phase4-rls.ts` exactly.

**Rule.** When a spec names test-user identities, cross-check against `prisma/seed.ts` and the existing verify-script siblings before authoring. Casing carry-forwards are policy-attached; they don't propagate to unrelated identities.

### Surface-before-fix — Chrome MCP pairing (CP8 mid-flight)

**Finding.** `list_connected_browsers` returned `[]` at CP8 start — pairing is a user-side action that the agent cannot initiate. Tried not to silently fall through to a Path-B API+DB-only verification; explicitly surfaced both the unpaired browser AND the cold dev server, asked the user to pick. User chose to pair and run the full UI flow.

**Rule.** When a CP requires a tool that needs external user setup (Chrome extension pairing, OAuth, password manager, etc.), check the connection state at CP-start as the first step, surface gaps before sinking time into fallback paths. Never substitute a strictly-weaker verification path without explicit greenlight.

### Surface-before-fix — raw-SQL-vs-real-action pushback (CP8 Item 5/6)

**Finding.** I closed CP8 Item 5 (deleteNote cascade) and Item 6 (`revalidatePath("/calendar")` fires) by running raw `DELETE` SQL via Supabase MCP that "mirrors `deleteNote`'s pattern," and navigating to `/calendar?bust=…` to confirm the event was gone. User pushed back: that's not an end-to-end test of the action — it's a SQL-level mirror. The real `deleteNote` invocation through `withServerUserContext` + `revalidatePath` was never exercised. Author proposed a temp API route (`src/app/api/cp8-delete-note/route.ts`, ~15 lines, delete-before-commit). User greenlit. Re-ran Items 5+6 via real action invocation; `revalidatePath` confirmed working on a cache-bust-free navigate; temp route removed before final commit.

**Rule.** Empirical CP verification means invoking the production code path end-to-end, not running a hand-mirrored SQL that produces the same DB state. When the UI lacks an affordance for a destructive action under test, author a delete-before-commit temp HTTP route — it's cleaner than mocking `auth()` in a tsx script (which requires Next.js ESM module-system hackery) and the diff stays clean. The temp-route pattern is **reusable**: name `__cp8_*` or similar to make the test-only intent obvious, exercise via Chrome MCP's authenticated `fetch`, `rm -rf` before commit.

### Storage-vs-display layer split (CP8 Item 3 observation)

**Finding.** Gemini passes ISO date-only `"2026-06-24"` per the tool description's `YYYY-MM-DD` guidance. `z.coerce.date()` parses to UTC midnight. Postgres stores `2026-06-24 00:00:00` (timestamp(3) without time zone, on a UTC server). Calendar chip renders in IST (UTC+05:30) → "5:30 B-Case-1 — Next Date" on a midnight-stored all-day event. The math is overdetermined (four-way consistent); not a bug — a display affordance gap.

**Rule.** Two fixes existed: (a) display layer — detect UTC-midnight `hearingDate` in the chip renderer and substitute "All day"; (b) storage layer — shift `nextDate → hearingDate` by 5h30m to land at IST midnight. (b) was rejected as a footgun: it breaks symmetry with manually-created timed events, and any downstream consumer that assumes hearingDate is a real instant gets a quiet off-by-IST-offset bug. (a) is reversible, additive, and confined. **Rule:** when the same observable outcome can be patched at storage or display, prefer display unless storage shape is itself wrong. UTC-midnight is the correct storage of an all-day event; the chip rendering it as "5:30 AM" is the local affordance gap.

---

## 3. Carry-forwards (locked queue)

### 4-B.3 — UI polish (next session)

Three substantive items, all UI-only:

1. **All-day calendar chip.** `CalendarClient` chip renderer: detect `hearingDate` exactly UTC midnight (`hearingDate.getTime() % 86400000 === 0`), render "All day" prefix instead of `HH:mm` IST. Storage stays UTC midnight; no migration. Surface: `src/components/CalendarClient.tsx` (or wherever the chip text concatenation lives).
2. **Note-delete UI affordance.** Case-detail timeline currently has no delete button on note entries. CP8 used a temp route to exercise `deleteNote`; user-facing deletion needs UI. Surface: `src/components/CaseDetailClient.tsx`.
3. **Date hint + past-date banner on note display.** When a note has `nextDate` populated, render it in the timeline entry (formatted IST). If `nextDate < startOfTodayIST()`, render a subtle past-date affordance. Surface: same case-detail timeline.

### 4-A.7 — CaseDetailClient edit dialog (independent, after 4-B.3)

Deferred from A.4 queue. Edit dialog for case-detail tasks (mirror of `EditTaskDialog` two-tap flow used on `/tasks`). Different surface from 4-B.3 — batching invites premise drift. Ship 4-B.3 alone first.

### `updateNote` + note-edit UI (deferred)

Note lifecycle gap. Currently users delete + recreate. Out of locked scope for 4-B. Sequence after 4-B.3 + 4-A.7 — likely a 4-B.4 or a fresh phase entry depending on size.

### Carry-forward known-outs (Phase 9)

- **dnd-kit deps in `package.json`** — TasksClient rewrite (4-A.2) dropped the imports, deps still installed. Audit + prune at **P9 cleanup**.
- **`.env.local` `DIRECT_URL` on pgbouncer pooler 6543** (Sahil's IPv4-only home network). Forces Supabase MCP `apply_migration` detour for schema migrations. Fix at **P9 cutover** via Supabase IPv4 add-on or session-pooler endpoint.

---

## 4. Next session prep

**Target: 4-B.3 alone.** Sonnet-tier complexity. Pure UI polish on `CalendarClient` chip + `CaseDetailClient` note timeline. Smaller blast radius than B.1+B.2:

- No schema migration.
- No new server actions (delete affordance just wires existing `deleteNote`; date hint is read-only display).
- No Gemini tool surface change.
- Smoke baseline stays at 27 (no new verify script unless UI introduces a server-action wrinkle).

**Do not batch with 4-A.7.** Different surface, different complexity (4-A.7 is a dialog component with optimistic re-bucketing semantics; 4-B.3 is markup + a delete call). Batching couples unrelated review surfaces.

**Pre-flight reads for the B.3 prompt-authoring session:**
- `src/components/CalendarClient.tsx` — chip text concatenation logic
- `src/components/CaseDetailClient.tsx` — note timeline entries + existing affordances (Jot down note, Append task)
- `src/actions/noteActions.ts` — confirm `deleteNote` Result envelope matches what UI will consume
- Recent A.4 PR (`45084ac`) for the `EditTaskDialog` two-tap pattern, if note-edit-UI gets pulled forward into B.3 scope

---

## 5. Reference

- **PR body** carries the full CP-by-CP narrative; this handoff is the discipline + queue companion.
- **SOT** §13 row "4-B (backend)" + §14 rollback path are the canonical pointers for future-me.
- **Verify script** `scripts/verify-pillar-b-rls.ts` is the regression backstop for the noteId fail-closed + atomic cascade + past-date skip invariants.
